import { getPineconeClient } from "@/lib/pinecone";

export const DEFAULT_SEMANTIC_INDEX = "agent-traces-semantic";
export const DEFAULT_KEYWORD_INDEX = "agent-traces";
export const DEFAULT_NAMESPACE = "traces";

const CONTENT_TEXT_FIELD = ".content.text";
const DOCUMENTS_API_VERSION = "2026-01.alpha";
const RRF_K = 60;
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;

function escapeLucene(query: string): string {
  return query.replace(LUCENE_SPECIAL, "\\$&");
}

export function buildLuceneQuery(query: string): string {
  const escapedTerms = escapeLucene(query);
  const phraseEscaped = query.replace(/"/g, '\\"');
  return `${CONTENT_TEXT_FIELD}:("${phraseEscaped}"^2 ${escapedTerms})`;
}

const hostCache = new Map<string, string>();

async function getKeywordIndexHost(keywordIndex: string): Promise<string> {
  const cached = hostCache.get(keywordIndex);
  if (cached) return cached;
  const pc = getPineconeClient();
  const desc = await pc.describeIndex(keywordIndex);
  hostCache.set(keywordIndex, desc.host);
  return desc.host;
}

export interface RawHit {
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

export interface MergedHit extends RawHit {
  sources: string[];
  semanticRank: number | null;
  keywordRank: number | null;
  semanticScore: number | null;
  keywordScore: number | null;
}

function parseHitFields(fields: Record<string, unknown>): Omit<RawHit, "id" | "score"> {
  const traceId = (fields.trace_id as string) ?? (fields.source_id as string) ?? "";
  const parts = traceId.replace(".json", "").split("__");
  const rawTags = fields.tags;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === "string")
    : [];
  return {
    chunkText: (fields.chunk_text as string) ?? "",
    role: (fields.role as string) ?? "unknown",
    traceId,
    turnIndex: (fields.turn_index as number) ?? 0,
    chunkIndex: (fields.chunk_index as number) ?? 0,
    project: (fields.project as string) || parts[0] || "",
    issue: (fields.title as string) || parts[1] || "",
    tags,
  };
}

export async function semanticSearch(
  query: string,
  topK: number,
  filter: Record<string, unknown>,
  semanticIndex: string,
  namespace: string
): Promise<RawHit[]> {
  const pc = getPineconeClient();
  const ns = pc.index(semanticIndex).namespace(namespace);

  const searchOptions: Parameters<typeof ns.searchRecords>[0] = {
    query: {
      topK,
      inputs: { text: query },
      ...(Object.keys(filter).length > 0 && { filter }),
    },
  };

  const results = await ns.searchRecords(searchOptions);

  return results.result.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...parseHitFields(hit.fields as Record<string, unknown>),
  }));
}

export async function keywordSearch(
  query: string,
  topK: number,
  filter: Record<string, unknown>,
  keywordIndex: string,
  namespace: string
): Promise<RawHit[]> {
  const host = await getKeywordIndexHost(keywordIndex);
  const apiKey = process.env.PINECONE_API_KEY!;

  const kwFilter: Record<string, unknown> = {};
  if (filter.role) kwFilter[".role"] = filter.role;
  if (filter.trace_id) kwFilter[".trace_id"] = filter.trace_id;

  const luceneQuery = buildLuceneQuery(query);
  const requestBody: Record<string, unknown> = {
    top_k: topK,
    score_by: [{ type: "query_string", query: luceneQuery }],
    include_fields: ["*"],
  };
  if (Object.keys(kwFilter).length > 0) {
    requestBody.filter = kwFilter;
  }

  const res = await fetch(
    `https://${host}/namespaces/${namespace}/documents/search`,
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
    const traceId = (match[".trace_id"] as string) ?? (match[".source_id"] as string) ?? "";
    const parts = traceId.replace(".json", "").split("__");
    const rawTags = match[".tags"];
    const tags: string[] = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string")
      : [];
    return {
      id: match.id as string,
      score: match.score as number,
      chunkText: (match[".content.text"] as string) ?? "",
      role: (match[".role"] as string) ?? "unknown",
      traceId,
      turnIndex: (match[".turn_index"] as number) ?? 0,
      chunkIndex: (match[".content.chunk_index"] as number) ?? 0,
      project: (match[".project"] as string) || parts[0] || "",
      issue: (match[".title"] as string) || parts[1] || "",
      tags,
    };
  });
}

export function reciprocalRankFusion(
  semanticHits: RawHit[],
  keywordHits: RawHit[],
  limit: number
): MergedHit[] {
  const merged = new Map<
    string,
    {
      hit: RawHit;
      rrfScore: number;
      sources: string[];
      semanticRank: number | null;
      keywordRank: number | null;
      semanticScore: number | null;
      keywordScore: number | null;
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
      semanticScore: hit.score,
      keywordScore: null,
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
      existing.keywordScore = hit.score;
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
        semanticScore: null,
        keywordScore: hit.score,
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
    semanticScore: entry.semanticScore,
    keywordScore: entry.keywordScore,
  }));
}

/**
 * Merge multiple ranked lists via RRF. Each list is treated as an independent
 * ranking — hits appearing in more lists get higher fused scores.
 */
export function multiListRRF(hitLists: RawHit[][], limit: number): MergedHit[] {
  const merged = new Map<string, { hit: RawHit; rrfScore: number }>();

  for (const list of hitLists) {
    for (let i = 0; i < list.length; i++) {
      const hit = list[i];
      const contribution = 1 / (RRF_K + i + 1);
      const existing = merged.get(hit.id);
      if (existing) {
        existing.rrfScore += contribution;
        if (existing.hit.tags.length === 0 && hit.tags.length > 0) {
          existing.hit.tags = hit.tags;
        }
      } else {
        merged.set(hit.id, { hit, rrfScore: contribution });
      }
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((e) => ({
      ...e.hit,
      score: e.rrfScore,
      sources: [],
      semanticRank: null,
      keywordRank: null,
      semanticScore: null,
      keywordScore: null,
    }));
}

export function deduplicateByTurn(hits: MergedHit[]): MergedHit[] {
  const seen = new Map<string, MergedHit>();
  for (const hit of hits) {
    const key = `${hit.traceId}::${hit.turnIndex}`;
    const existing = seen.get(key);
    if (!existing || hit.score > existing.score) {
      seen.set(key, hit);
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

export async function rerankHits(
  query: string,
  hits: MergedHit[],
  topN: number
): Promise<MergedHit[]> {
  if (hits.length <= 1) return hits;
  const pc = getPineconeClient();
  const documents = hits.map((h) => ({ text: h.chunkText }));
  const result = await pc.inference.rerank({
    model: "pinecone-rerank-v0",
    query,
    documents,
    topN,
    rankFields: ["text"],
  });
  return result.data.map((r) => ({
    ...hits[r.index],
    score: r.score,
  }));
}

export function buildFilter(filters?: {
  role?: string;
  project?: string;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (filters?.role) filter.role = { $eq: filters.role };
  if (filters?.project)
    filter.trace_id = { $regex: `^${filters.project}__` };
  return filter;
}
