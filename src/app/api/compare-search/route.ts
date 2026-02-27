import { NextRequest, NextResponse } from "next/server";
import { resolveNamespace } from "@/lib/pinecone";
import {
  DEFAULT_SEMANTIC_INDEX,
  DEFAULT_KEYWORD_INDEX,
  DEFAULT_NAMESPACE,
  semanticSearch,
  keywordSearch,
  buildLuceneQuery,
  type RawHit,
} from "@/lib/search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 10 } = body as {
      query: string;
      topK?: number;
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const trimmed = query.trim();
    const ns = await resolveNamespace(DEFAULT_SEMANTIC_INDEX, DEFAULT_NAMESPACE);

    const [semanticResult, keywordResult] = await Promise.allSettled([
      semanticSearch(trimmed, topK, {}, DEFAULT_SEMANTIC_INDEX, ns),
      keywordSearch(trimmed, topK, {}, DEFAULT_KEYWORD_INDEX, ns),
    ]);

    const semHits: RawHit[] =
      semanticResult.status === "fulfilled" ? semanticResult.value : [];
    const kwHits: RawHit[] =
      keywordResult.status === "fulfilled" ? keywordResult.value : [];

    const semIds = new Set(semHits.map((h) => h.id));
    const kwIds = new Set(kwHits.map((h) => h.id));

    const overlap = semHits.filter((h) => kwIds.has(h.id)).length;

    return NextResponse.json({
      semantic: semHits,
      keyword: kwHits,
      queries: {
        semantic: trimmed,
        keyword: buildLuceneQuery(trimmed),
      },
      meta: {
        semanticCount: semHits.length,
        keywordCount: kwHits.length,
        overlap,
        semanticOnly: semHits.filter((h) => !kwIds.has(h.id)).length,
        keywordOnly: kwHits.filter((h) => !semIds.has(h.id)).length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
