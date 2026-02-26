import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient, resolveNamespace } from "@/lib/pinecone";

const DEFAULT_INDEX = "agent-traces-semantic";
const DEFAULT_NAMESPACE = "traces";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 10, filters, rerank, indexName, namespace } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; project?: string };
      rerank?: boolean;
      indexName?: string;
      namespace?: string;
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const idxName = indexName || DEFAULT_INDEX;
    const resolvedNs = namespace ?? await resolveNamespace(idxName, DEFAULT_NAMESPACE);
    const pc = getPineconeClient();
    const idx = pc.index(idxName);
    const ns = idx.namespace(resolvedNs);

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
      const traceId = (fields.trace_id as string) ?? (fields.source_id as string) ?? "";
      const parts = traceId.replace(".json", "").split("__");
      const rawTags = fields.tags;
      const tags: string[] = Array.isArray(rawTags)
        ? rawTags.filter((t): t is string => typeof t === "string")
        : [];

      return {
        id: hit._id,
        score: hit._score,
        chunkText: fields.chunk_text,
        role: fields.role,
        traceId,
        turnIndex: fields.turn_index,
        chunkIndex: fields.chunk_index,
        project: (fields.project as string) || parts[0] || "",
        issue: (fields.title as string) || parts[1] || "",
        tags,
      };
    });

    return NextResponse.json({ hits, usage: results.usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
