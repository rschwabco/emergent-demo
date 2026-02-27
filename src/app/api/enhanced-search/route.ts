import { NextRequest, NextResponse } from "next/server";
import { resolveNamespace } from "@/lib/pinecone";
import { getOpenAIClient } from "@/lib/openai";
import {
  DEFAULT_SEMANTIC_INDEX,
  DEFAULT_KEYWORD_INDEX,
  DEFAULT_NAMESPACE,
  semanticSearch,
  keywordSearch,
  multiListRRF,
  deduplicateByTurn,
  rerankHits,
  buildFilter,
  type RawHit,
} from "@/lib/search";

const REWRITE_MODEL = "gpt-4o-mini";

const REWRITE_PROMPT = `You rewrite search queries for a corpus of AI coding agent conversation traces from SWE-bench (frameworks: django, scikit-learn, matplotlib, pytest-dev, sympy, astropy, sphinx-doc, pallets).

Given a query, produce 2 alternative phrasings that would retrieve complementary results. Focus on vocabulary variation, synonyms, and different angles of the same intent.

Return ONLY a JSON array of 2 strings. No explanation, no markdown.`;

async function getQueryRewrites(query: string): Promise<string[]> {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: REWRITE_MODEL,
      temperature: 0.7,
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: query },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string").slice(0, 2)
      : [];
  } catch {
    return [];
  }
}

async function hybridSearchForQuery(
  query: string,
  perSourceK: number,
  filter: Record<string, unknown>,
  semanticIdx: string,
  keywordIdx: string,
  ns: string
): Promise<RawHit[]> {
  const [semanticHits, keywordHits] = await Promise.allSettled([
    semanticSearch(query, perSourceK, filter, semanticIdx, ns),
    keywordSearch(query, perSourceK, filter, keywordIdx, ns),
  ]);

  const sHits =
    semanticHits.status === "fulfilled" ? semanticHits.value : [];
  const kHits =
    keywordHits.status === "fulfilled" ? keywordHits.value : [];

  return [...sHits, ...kHits];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      topK = 15,
      filters,
      indexName,
      keywordIndexName,
      namespace,
    } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; framework?: string };
      indexName?: string;
      keywordIndexName?: string;
      namespace?: string;
    };

    const semanticIdx = indexName || DEFAULT_SEMANTIC_INDEX;
    const keywordIdx = keywordIndexName || DEFAULT_KEYWORD_INDEX;
    const ns =
      namespace ?? (await resolveNamespace(semanticIdx, DEFAULT_NAMESPACE));

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const trimmed = query.trim();
    const filter = buildFilter(filters);
    const perSourceK = Math.max(topK * 3, 30);

    // Fire query rewriting and original search in parallel
    const [rewriteResult, originalHits] = await Promise.all([
      getQueryRewrites(trimmed),
      hybridSearchForQuery(
        trimmed,
        perSourceK,
        filter,
        semanticIdx,
        keywordIdx,
        ns
      ),
    ]);

    const rewrites = rewriteResult;

    // Fire rewrite searches in parallel
    const rewriteHitArrays = await Promise.all(
      rewrites.map((rq) =>
        hybridSearchForQuery(rq, perSourceK, filter, semanticIdx, keywordIdx, ns)
      )
    );

    // Multi-list RRF merge across all queries
    const allLists = [originalHits, ...rewriteHitArrays];
    const rrfLimit = Math.max(topK * 3, 30);
    const rrfHits = multiListRRF(allLists, rrfLimit);
    const deduped = deduplicateByTurn(rrfHits);

    // Final rerank against the original query
    const hits = await rerankHits(trimmed, deduped, topK);

    return NextResponse.json({
      hits,
      rewrites,
      meta: {
        queriesSearched: 1 + rewrites.length,
        mergedCount: hits.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
