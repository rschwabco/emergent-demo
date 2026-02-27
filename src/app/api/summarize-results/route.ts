import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import {
  buildCacheKey,
  getCachedSummary,
  setCachedSummary,
} from "@/lib/summary-cache";
import {
  createJob,
  getJob,
  findJobByCacheKey,
  appendToJob,
  completeJob,
  failJob,
  getRecentJobs,
  dismissJob,
} from "@/lib/summary-jobs";

const MODEL = "gpt-5.2";
const MAX_HITS_FOR_LLM = 10;
const MAX_CHUNK_LEN = 300;

interface HitPayload {
  id: string;
  chunkText: string;
  role: string;
  project: string;
  issue: string;
  turnIndex: number;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

function buildPromptContent(query: string, hits: HitPayload[]): string {
  const snippets = hits.slice(0, MAX_HITS_FOR_LLM).map((h, i) => {
    const meta = `[${h.role}] ${h.project}/${h.issue} turn ${h.turnIndex}`;
    return `${i + 1}. ${meta}\n${truncate(h.chunkText, MAX_CHUNK_LEN)}`;
  });

  const projects = [...new Set(hits.map((h) => h.project))];
  const roles = [...new Set(hits.map((h) => h.role))];

  return [
    `Search query: "${query}"`,
    `Result set: ${hits.length} hits across ${projects.length} project(s) (${projects.join(", ")}), roles: ${roles.join(", ")}`,
    "",
    "Top result chunks:",
    ...snippets,
  ].join("\n");
}

const SYSTEM_PROMPT = `You analyze AI coding agent traces from SWE-bench (141K chunks across 8 open-source projects). Given a search query and its top result chunks, produce a concise summary of the result set.

Structure your response with exactly these 4 sections. Each heading MUST use the format **Category: Short descriptive title** where the title is specific to what you found (5-8 words, no period).

**Patterns: <specific title>** 1-2 sentences on recurring strategies or approaches you see across results.
**Common behaviors: <specific title>** 1-2 sentences on what agents tend to do (tool use, reasoning style, error handling, etc.).
**Distribution: <specific title>** 1 sentence noting which projects or roles dominate and any clustering.
**Notable: <specific title>** 1 sentence on anything surprising or unusual in these results, if applicable.

Example heading: **Patterns: Grep-first navigation before editing files**

Keep it tight — aim for 4-6 sentences total. Be specific and concrete, not generic. Reference actual content from the chunks.`;

async function runSummaryJob(
  jobId: string,
  cacheKey: string,
  query: string,
  hits: HitPayload[]
) {
  try {
    const openai = getOpenAIClient();
    const userContent = buildPromptContent(query, hits);

    const stream = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_completion_tokens: 500,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        appendToJob(jobId, delta);
      }
    }

    const job = getJob(jobId);
    if (job) {
      completeJob(jobId);
      setCachedSummary(cacheKey, job.text).catch(() => {});
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM call failed";
    failJob(jobId, message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, hits } = body as {
      query: string;
      hits: HitPayload[];
    };

    if (!query?.trim() || !hits?.length) {
      return NextResponse.json(
        { error: "query and hits are required" },
        { status: 400 }
      );
    }

    const hitIds = hits.map((h) => h.id);
    const cacheKey = buildCacheKey(query, hitIds);

    const cached = await getCachedSummary(cacheKey);
    if (cached) {
      return NextResponse.json({ summary: cached, cached: true });
    }

    const existing = findJobByCacheKey(cacheKey);
    if (existing) {
      return NextResponse.json({ jobId: existing.id, status: existing.status });
    }

    const job = createJob(query, cacheKey);

    // Fire and forget — the job runs to completion regardless of client connection
    runSummaryJob(job.id, cacheKey, query, hits);

    return NextResponse.json({ jobId: job.id, status: "pending" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const action = url.searchParams.get("action");

  if (action === "dismiss" && jobId) {
    dismissJob(jobId);
    return NextResponse.json({ ok: true });
  }

  if (action === "list") {
    const jobs = getRecentJobs();
    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        query: j.query,
        status: j.status,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        hasText: j.text.length > 0,
        error: j.error,
      })),
    });
  }

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId query param is required" },
      { status: 400 }
    );
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    query: job.query,
    status: job.status,
    text: job.text,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}
