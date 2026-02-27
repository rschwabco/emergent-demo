import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient, resolveNamespace } from "@/lib/pinecone";

const DEFAULT_INDEX = "agent-traces-semantic";
const DEFAULT_NAMESPACE = "traces";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tag, limit = 100, indexName, namespace } = body as {
      tag: string;
      limit?: number;
      indexName?: string;
      namespace?: string;
    };

    if (!tag?.trim()) {
      return NextResponse.json({ error: "tag is required" }, { status: 400 });
    }

    const idxName = indexName || DEFAULT_INDEX;
    const resolvedNs = namespace ?? await resolveNamespace(idxName, DEFAULT_NAMESPACE);
    const pc = getPineconeClient();
    const idx = pc.index(idxName);

    const response = await idx.fetchByMetadata({
      filter: { tags: { $in: [tag.trim().toLowerCase()] } },
      limit,
      namespace: resolvedNs,
    });

    const hits = Object.entries(response.records).map(([id, record]) => {
      const meta = record.metadata as Record<string, unknown>;
      const traceId = (meta.trace_id as string) || "";
      const parts = traceId.replace(".json", "").split("__");
      const rawTags = meta.tags;
      const tags: string[] = Array.isArray(rawTags)
        ? rawTags.filter((t): t is string => typeof t === "string")
        : [];

      return {
        id,
        score: 1,
        chunkText: meta.chunk_text ?? "",
        role: meta.role ?? "unknown",
        traceId,
        turnIndex: meta.turn_index ?? 0,
        chunkIndex: meta.chunk_index ?? 0,
        framework: parts[0] ?? "",
        trace: parts[1] ?? "",
        tags,
      };
    });

    return NextResponse.json({ hits });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
