import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

const INDEX_NAME = "agent-traces-semantic";
const NAMESPACE = "traces";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 10, filters, rerank } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; project?: string };
      rerank?: boolean;
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const pc = getPineconeClient();
    const idx = pc.index(INDEX_NAME);
    const ns = idx.namespace(NAMESPACE);

    const filter: Record<string, unknown> = {};
    if (filters?.role) {
      filter.role = { $eq: filters.role };
    }
    if (filters?.project) {
      filter.trace_id = { $regex: `^${filters.project}__` };
    }

    const searchOptions: Parameters<typeof ns.searchRecords>[0] = {
      query: {
        topK: rerank ? Math.max(topK * 3, 30) : topK,
        inputs: { text: query },
        ...(Object.keys(filter).length > 0 && { filter }),
      },
    };

    if (rerank) {
      searchOptions.rerank = {
        model: "pinecone-rerank-v0",
        topN: topK,
        rankFields: ["chunk_text"],
      };
    }

    const results = await ns.searchRecords(searchOptions);

    const hits = results.result.hits.map((hit) => {
      const fields = hit.fields as Record<string, unknown>;
      const traceId = fields.trace_id as string;
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
      };
    });

    return NextResponse.json({ hits, usage: results.usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
