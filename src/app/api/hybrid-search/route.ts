import { NextRequest, NextResponse } from "next/server";
import { resolveNamespace } from "@/lib/pinecone";
import {
  DEFAULT_SEMANTIC_INDEX,
  DEFAULT_KEYWORD_INDEX,
  DEFAULT_NAMESPACE,
  semanticSearch,
  keywordSearch,
  reciprocalRankFusion,
  deduplicateByTurn,
  rerankHits,
  buildFilter,
} from "@/lib/search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      topK = 15,
      filters,
      rerank = true,
      indexName,
      keywordIndexName,
      namespace,
    } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; framework?: string };
      rerank?: boolean;
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
    const semanticFilter = buildFilter(filters);
    const perSourceK = Math.max(topK * 4, 40);

    const [semanticHits, keywordHits] = await Promise.allSettled([
      semanticSearch(trimmed, perSourceK, semanticFilter, semanticIdx, ns),
      keywordSearch(trimmed, perSourceK, semanticFilter, keywordIdx, ns),
    ]);

    const sHits =
      semanticHits.status === "fulfilled" ? semanticHits.value : [];
    const kHits =
      keywordHits.status === "fulfilled" ? keywordHits.value : [];

    const rrfLimit = rerank ? Math.max(topK * 3, 30) : topK;
    const rrfHits = reciprocalRankFusion(sHits, kHits, rrfLimit);
    const deduped = deduplicateByTurn(rrfHits);

    const hits = rerank
      ? await rerankHits(trimmed, deduped, topK)
      : deduped.slice(0, topK);

    return NextResponse.json({
      hits,
      meta: {
        semanticCount: sHits.length,
        keywordCount: kHits.length,
        mergedCount: hits.length,
        reranked: rerank,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
