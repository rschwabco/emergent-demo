import { NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";
import { getOpenAIClient } from "@/lib/openai";
import { PROBES } from "@/lib/explore-probes";
import { getCachedDashboard, setCachedDashboard } from "@/lib/dashboard-cache";

const INDEX_NAME = "agent-traces-semantic";
const NAMESPACE = "traces";
const HITS_PER_PROBE = 25;
const SNIPPETS_FOR_LLM = 10;
const EXPANSION_QUERIES_PER_PROBE = 3;
const EXPANSION_TOP_K = 25;
const MODEL = "gpt-5.2";

interface HitFields {
  trace_id: string;
  chunk_text: string;
  role: string;
  turn_index: number;
  chunk_index: number;
}

interface ParsedHit {
  id: unknown;
  score: unknown;
  chunkText: string;
  role: string;
  traceId: string;
  turnIndex: number;
  chunkIndex: number;
  project: string;
  issue: string;
  behaviorId: string;
}

function parseHit(
  hit: { _id: unknown; _score: unknown; fields: unknown },
  behaviorId: string
): ParsedHit {
  const fields = hit.fields as HitFields;
  const traceId = fields.trace_id;
  const parts = traceId.replace(".json", "").split("__");
  return {
    id: hit._id,
    score: hit._score,
    chunkText: fields.chunk_text,
    role: fields.role,
    traceId,
    turnIndex: fields.turn_index,
    chunkIndex: fields.chunk_index,
    project: parts[0],
    issue: parts[1],
    behaviorId,
  };
}

function truncateSnippet(text: string, maxLen = 300): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

async function generateExpandedQueries(
  label: string,
  description: string,
  seedSnippets: string[]
): Promise<string[]> {
  const openai = getOpenAIClient();
  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_completion_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You generate diverse semantic search queries for finding AI coding agent behaviors in SWE-bench traces. Given a behavior pattern and example chunks that matched it, generate exactly ${EXPANSION_QUERIES_PER_PROBE} NEW search queries that would find MORE examples of this behavior from different angles. Each query should target a different aspect or variation and use different vocabulary than the original. Be specific, 10-25 words each. Return ONLY a JSON array of strings.`,
      },
      {
        role: "user",
        content: `Behavior: "${label}" — ${description}\n\nExample matching chunks:\n${seedSnippets.map((s, i) => `${i + 1}. ${s}`).join("\n\n")}`,
      },
    ],
  });

  const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "");
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed)
      ? parsed.filter((q: unknown): q is string => typeof q === "string")
      : [];
  } catch {
    return [];
  }
}

async function generateBehaviorInsight(
  label: string,
  snippets: string[]
): Promise<string> {
  const openai = getOpenAIClient();
  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_completion_tokens: 150,
    messages: [
      {
        role: "system",
        content:
          "You analyze AI coding agent traces from SWE-bench. Given sample chunks matching a behavior pattern, write a concise 1-2 sentence insight about what agents actually do. Be specific and quantitative where possible. No hedging.",
      },
      {
        role: "user",
        content: `Behavior pattern: "${label}"\n\nSample chunks:\n${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n\n")}`,
      },
    ],
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

async function generateProjectNarrative(
  project: string,
  snippets: { behavior: string; text: string }[]
): Promise<string> {
  const openai = getOpenAIClient();
  const grouped = snippets
    .map((s) => `[${s.behavior}] ${s.text}`)
    .join("\n\n");
  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_completion_tokens: 150,
    messages: [
      {
        role: "system",
        content:
          "You analyze AI coding agent traces from SWE-bench. Given sample chunks from a specific open-source project, write a concise 1-2 sentence narrative about what kinds of issues agents tackle and how they approach them in this project. Be specific.",
      },
      {
        role: "user",
        content: `Project: "${project}"\n\nSample trace chunks (labeled by behavior):\n${grouped}`,
      },
    ],
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

async function generateCrossCuttingInsights(
  behaviorSummaries: { label: string; insight: string }[]
): Promise<string[]> {
  const openai = getOpenAIClient();
  const summaryText = behaviorSummaries
    .map((b) => `- ${b.label}: ${b.insight}`)
    .join("\n");
  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_completion_tokens: 400,
    messages: [
      {
        role: "system",
        content:
          'You analyze AI coding agent traces from SWE-bench (141K chunks across 8 open-source projects). Given summaries of 10 behavior patterns, produce exactly 3-5 high-level observations about how agents work overall. Each observation should be a single punchy sentence. Return them as a JSON array of strings, e.g. ["observation 1", "observation 2", ...].',
      },
      {
        role: "user",
        content: `Behavior pattern summaries:\n${summaryText}`,
      },
    ],
  });
  const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "");
    return JSON.parse(cleaned);
  } catch {
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => l.replace(/^[-*\d.]+\s*/, "").trim());
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bustCache = url.searchParams.get("bust") === "1";

    if (!bustCache) {
      const cached = await getCachedDashboard<Record<string, unknown>>();
      if (cached) {
        return NextResponse.json(
          { ...cached, cached: true },
          {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
            },
          }
        );
      }
    }

    const pc = getPineconeClient();
    const idx = pc.index(INDEX_NAME);
    const ns = idx.namespace(NAMESPACE);

    // Phase 1: Parallel Pinecone calls
    const [statsResult, ...probeResults] = await Promise.all([
      idx.describeIndexStats(),
      ...PROBES.map(async (probe) => {
        const results = await ns.searchRecords({
          query: {
            topK: HITS_PER_PROBE,
            inputs: { text: probe.query },
          },
        });
        return { probe, hits: [...results.result.hits] };
      }),
    ]);

    const totalChunks =
      statsResult.namespaces?.traces?.recordCount ??
      statsResult.totalRecordCount ??
      0;

    // Expansion is opt-in: ?expand=1 triggers query expansion
    const shouldExpand = url.searchParams.get("expand") === "1";
    const expandedQueriesMap = new Map<string, string[]>();
    const seedHitCounts = new Map<string, number>();

    for (const { probe, hits } of probeResults) {
      seedHitCounts.set(probe.id, hits.length);
    }

    if (shouldExpand) {
      // Phase 1.5: Use seed results to generate diverse expansion queries
      const expansionQueryPromises = probeResults.map(({ probe, hits }) => {
        const seedSnippets = hits
          .slice(0, 5)
          .map((h) =>
            truncateSnippet((h.fields as HitFields).chunk_text, 200)
          );
        return generateExpandedQueries(
          probe.label,
          probe.description,
          seedSnippets
        );
      });
      const expandedQueriesPerProbe = await Promise.all(
        expansionQueryPromises
      );

      for (let i = 0; i < probeResults.length; i++) {
        expandedQueriesMap.set(
          probeResults[i].probe.id,
          expandedQueriesPerProbe[i]
        );
      }

      // Phase 1.6: Run all expansion queries in parallel
      const expansionResults = await Promise.all(
        probeResults.flatMap((_pr, probeIdx) =>
          (expandedQueriesPerProbe[probeIdx] ?? []).map(
            async (expandedQuery) => {
              const results = await ns.searchRecords({
                query: {
                  topK: EXPANSION_TOP_K,
                  inputs: { text: expandedQuery },
                },
              });
              return { probeIdx, hits: results.result.hits };
            }
          )
        )
      );

      // Merge expansion hits into probe results, deduplicating within each probe
      for (const { probeIdx, hits } of expansionResults) {
        const existingIds = new Set(
          probeResults[probeIdx].hits.map((h) => h._id as string)
        );
        for (const hit of hits) {
          if (!existingIds.has(hit._id as string)) {
            existingIds.add(hit._id as string);
            probeResults[probeIdx].hits.push(hit);
          }
        }
      }
    }

    // Parse all hits (cross-probe deduplication)
    const seenIds = new Set<string>();
    const allParsedHits: ParsedHit[] = [];

    const behaviorData = probeResults.map(({ probe, hits }) => {
      const parsed = hits
        .filter((hit) => {
          if (seenIds.has(hit._id as string)) return false;
          seenIds.add(hit._id as string);
          return true;
        })
        .map((hit) => parseHit(hit, probe.id));

      allParsedHits.push(...parsed);

      const projects = [...new Set(parsed.map((h) => h.project))];
      return {
        probe,
        parsed,
        projects,
      };
    });

    // Phase 2: Parallel GPT-5.2 calls
    // 2a: Behavior insights (10 calls)
    const behaviorInsightPromises = behaviorData.map(({ probe, parsed }) => {
      const snippets = parsed
        .slice(0, SNIPPETS_FOR_LLM)
        .map((h) => truncateSnippet(h.chunkText));
      return generateBehaviorInsight(probe.label, snippets);
    });

    // 2b: Project narratives (derived from hits grouped by project)
    const projectHitsMap = new Map<
      string,
      { behavior: string; text: string; hit: ParsedHit }[]
    >();
    for (const hit of allParsedHits) {
      const existing = projectHitsMap.get(hit.project) ?? [];
      const behavior =
        behaviorData.find((b) => b.probe.id === hit.behaviorId)?.probe.label ??
        hit.behaviorId;
      existing.push({
        behavior,
        text: truncateSnippet(hit.chunkText, 200),
        hit,
      });
      projectHitsMap.set(hit.project, existing);
    }

    const projectEntries = [...projectHitsMap.entries()]
      .filter(([, hits]) => hits.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    const projectNarrativePromises = projectEntries.map(([project, hits]) =>
      generateProjectNarrative(
        project,
        hits.slice(0, 8).map((h) => ({ behavior: h.behavior, text: h.text }))
      )
    );

    // Run behavior insights + project narratives in parallel
    const [behaviorInsights, ...projectNarratives] = await Promise.all([
      Promise.all(behaviorInsightPromises),
      ...projectNarrativePromises,
    ]);

    // 2c: Cross-cutting insights (needs behavior insights first)
    const behaviorSummaries = behaviorData.map(({ probe }, i) => ({
      label: probe.label,
      insight: behaviorInsights[i],
    }));
    const crossCuttingInsights =
      await generateCrossCuttingInsights(behaviorSummaries);

    // Build response
    const behaviors = behaviorData.map(({ probe, parsed, projects }, i) => ({
      id: probe.id,
      label: probe.label,
      description: probe.description,
      query: probe.query,
      insight: behaviorInsights[i],
      hitCount: parsed.length,
      seedHitCount: seedHitCounts.get(probe.id) ?? parsed.length,
      expandedQueries: expandedQueriesMap.get(probe.id) ?? [],
      projects,
      topHits: parsed.slice(0, 3).map((h) => ({
        id: h.id,
        score: h.score,
        chunkText: h.chunkText,
        role: h.role,
        traceId: h.traceId,
        turnIndex: h.turnIndex,
        chunkIndex: h.chunkIndex,
        project: h.project,
        issue: h.issue,
      })),
    }));

    const projects = projectEntries.map(([name, hits], i) => {
      const behaviorCounts = new Map<string, number>();
      for (const h of hits) {
        behaviorCounts.set(
          h.behavior,
          (behaviorCounts.get(h.behavior) ?? 0) + 1
        );
      }
      const topBehaviors = [...behaviorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([b]) => b);

      const topHit = hits[0].hit;
      return {
        name,
        narrative: projectNarratives[i],
        topBehaviors,
        hitCount: hits.length,
        topHit: {
          id: topHit.id,
          score: topHit.score,
          chunkText: topHit.chunkText,
          role: topHit.role,
          traceId: topHit.traceId,
          turnIndex: topHit.turnIndex,
          chunkIndex: topHit.chunkIndex,
          project: topHit.project,
          issue: topHit.issue,
        },
      };
    });

    // Role distribution
    const roleDistribution: Record<string, number> = {};
    for (const hit of allParsedHits) {
      roleDistribution[hit.role] = (roleDistribution[hit.role] ?? 0) + 1;
    }

    const responseData = {
      totalChunks,
      expanded: shouldExpand,
      crossCuttingInsights,
      behaviors,
      projects,
      roleDistribution,
    };

    await setCachedDashboard(responseData);

    return NextResponse.json(
      { ...responseData, cached: false },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Dashboard API error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
