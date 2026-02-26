import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

const SEMANTIC_INDEX = "agent-traces-semantic";
const KEYWORD_INDEX = "agent-traces";
const NAMESPACE = "traces";
const CONTENT_TEXT_FIELD = ".content.text";
const DOCUMENTS_API_VERSION = "2026-01.alpha";

const RRF_K = 60;

let cachedKeywordHost: string | null = null;

async function getKeywordIndexHost(): Promise<string> {
  if (cachedKeywordHost) return cachedKeywordHost;
  const pc = getPineconeClient();
  const desc = await pc.describeIndex(KEYWORD_INDEX);
  cachedKeywordHost = desc.host;
  return cachedKeywordHost;
}

interface RawHit {
  id: string;
  score: number;
  chunkText: string;
  role: string;
  traceId: string;
  turnIndex: number;
  chunkIndex: number;
  project: string;
  issue: string;
  tags: string[];
}

async function semanticSearch(
  query: string,
  topK: number,
  filter: Record<string, unknown>
): Promise<RawHit[]> {
  const pc = getPineconeClient();
  const ns = pc.index(SEMANTIC_INDEX).namespace(NAMESPACE);

  const searchOptions: Parameters<typeof ns.searchRecords>[0] = {
    query: {
      topK,
      inputs: { text: query },
      ...(Object.keys(filter).length > 0 && { filter }),
    },
  };

  const results = await ns.searchRecords(searchOptions);

  return results.result.hits.map((hit) => {
    const fields = hit.fields as Record<string, unknown>;
    const traceId = fields.trace_id as string;
    const parts = traceId.replace(".json", "").split("__");
    const rawTags = fields.tags;
    const tags: string[] = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string")
      : [];
    return {
      id: hit._id,
      score: hit._score,
      chunkText: (fields.chunk_text as string) ?? "",
      role: (fields.role as string) ?? "unknown",
      traceId,
      turnIndex: (fields.turn_index as number) ?? 0,
      chunkIndex: (fields.chunk_index as number) ?? 0,
      project: parts[0] ?? "",
      issue: parts[1] ?? "",
      tags,
    };
  });
}

async function keywordSearch(
  query: string,
  topK: number,
  filter: Record<string, unknown>
): Promise<RawHit[]> {
  const host = await getKeywordIndexHost();
  const apiKey = process.env.PINECONE_API_KEY!;

  const kwFilter: Record<string, unknown> = {};
  if (filter.role) kwFilter[".role"] = filter.role;
  if (filter.trace_id) kwFilter[".trace_id"] = filter.trace_id;

  const luceneQuery = `${CONTENT_TEXT_FIELD}:(${query})`;
  const requestBody: Record<string, unknown> = {
    top_k: topK,
    score_by: [{ type: "query_string", query: luceneQuery }],
    include_fields: ["*"],
  };
  if (Object.keys(kwFilter).length > 0) {
    requestBody.filter = kwFilter;
  }

  const res = await fetch(
    `https://${host}/namespaces/${NAMESPACE}/documents/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "X-Pinecone-Api-Version": DOCUMENTS_API_VERSION,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.matches ?? []).map((match: Record<string, unknown>) => {
    const traceId = (match[".trace_id"] as string) ?? "";
    const parts = traceId.replace(".json", "").split("__");
    return {
      id: match.id as string,
      score: match.score as number,
      chunkText: (match[".content.text"] as string) ?? "",
      role: (match[".role"] as string) ?? "unknown",
      traceId,
      turnIndex: (match[".turn_index"] as number) ?? 0,
      chunkIndex: (match[".content.chunk_index"] as number) ?? 0,
      project: parts[0] ?? "",
      issue: parts[1] ?? "",
      tags: [],
    };
  });
}

function reciprocalRankFusion(
  semanticHits: RawHit[],
  keywordHits: RawHit[],
  limit: number
) {
  const merged = new Map<
    string,
    {
      hit: RawHit;
      rrfScore: number;
      sources: string[];
      semanticRank: number | null;
      keywordRank: number | null;
    }
  >();

  for (let i = 0; i < semanticHits.length; i++) {
    const hit = semanticHits[i];
    const rrfScore = 1 / (RRF_K + i + 1);
    merged.set(hit.id, {
      hit,
      rrfScore,
      sources: ["semantic"],
      semanticRank: i + 1,
      keywordRank: null,
    });
  }

  for (let i = 0; i < keywordHits.length; i++) {
    const hit = keywordHits[i];
    const rrfContribution = 1 / (RRF_K + i + 1);
    const existing = merged.get(hit.id);
    if (existing) {
      existing.rrfScore += rrfContribution;
      existing.sources.push("keyword");
      existing.keywordRank = i + 1;
      if (existing.hit.tags.length === 0 && hit.tags.length > 0) {
        existing.hit.tags = hit.tags;
      }
    } else {
      merged.set(hit.id, {
        hit,
        rrfScore: rrfContribution,
        sources: ["keyword"],
        semanticRank: null,
        keywordRank: i + 1,
      });
    }
  }

  const sorted = [...merged.values()].sort((a, b) => b.rrfScore - a.rrfScore);

  return sorted.slice(0, limit).map((entry) => ({
    ...entry.hit,
    score: entry.rrfScore,
    sources: entry.sources,
    semanticRank: entry.semanticRank,
    keywordRank: entry.keywordRank,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 15, filters } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; project?: string };
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const trimmed = query.trim();

    const semanticFilter: Record<string, unknown> = {};
    if (filters?.role) semanticFilter.role = { $eq: filters.role };
    if (filters?.project)
      semanticFilter.trace_id = { $regex: `^${filters.project}__` };

    const perSourceK = Math.max(topK * 2, 20);

    const [semanticHits, keywordHits] = await Promise.allSettled([
      semanticSearch(trimmed, perSourceK, semanticFilter),
      keywordSearch(trimmed, perSourceK, semanticFilter),
    ]);

    const sHits =
      semanticHits.status === "fulfilled" ? semanticHits.value : [];
    const kHits =
      keywordHits.status === "fulfilled" ? keywordHits.value : [];

    const hits = reciprocalRankFusion(sHits, kHits, topK);

    return NextResponse.json({
      hits,
      meta: {
        semanticCount: sHits.length,
        keywordCount: kHits.length,
        mergedCount: hits.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
