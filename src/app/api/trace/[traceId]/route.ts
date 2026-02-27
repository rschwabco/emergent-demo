import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient, resolveNamespace } from "@/lib/pinecone";

const DEFAULT_INDEX = "agent-traces-semantic";
const DEFAULT_NAMESPACE = "traces";

interface TraceChunk {
  turnIndex: number;
  chunkIndex: number;
  role: string;
  text: string;
}

interface Turn {
  turnIndex: number;
  role: string;
  text: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
  try {
    const { traceId } = await params;

    if (!traceId) {
      return NextResponse.json(
        { error: "traceId is required" },
        { status: 400 }
      );
    }

    const url = new URL(_request.url);
    const indexName = url.searchParams.get("indexName") || DEFAULT_INDEX;
    const namespace = url.searchParams.get("namespace");
    const resolvedNs = namespace ?? await resolveNamespace(indexName, DEFAULT_NAMESPACE);

    const pc = getPineconeClient();
    const idx = pc.index(indexName);
    const ns = idx.namespace(resolvedNs);

    const results = await ns.searchRecords({
      query: {
        topK: 10000,
        inputs: { text: traceId },
        filter: {
          $or: [
            { trace_id: { $eq: traceId } },
            { source_id: { $eq: traceId } },
          ],
        },
      },
    });

    const chunks: TraceChunk[] = results.result.hits.map((hit) => {
      const fields = hit.fields as Record<string, unknown>;
      return {
        turnIndex: fields.turn_index as number,
        chunkIndex: fields.chunk_index as number,
        role: fields.role as string,
        text: fields.chunk_text as string,
      };
    });

    chunks.sort(
      (a, b) => a.turnIndex - b.turnIndex || a.chunkIndex - b.chunkIndex
    );

    const turns: Turn[] = [];
    let currentTurn: Turn | null = null;

    for (const chunk of chunks) {
      if (!currentTurn || currentTurn.turnIndex !== chunk.turnIndex) {
        if (currentTurn) turns.push(currentTurn);
        currentTurn = {
          turnIndex: chunk.turnIndex,
          role: chunk.role,
          text: chunk.text,
        };
      } else {
        currentTurn.text += chunk.text;
      }
    }
    if (currentTurn) turns.push(currentTurn);

    const parts = traceId.replace(".json", "").split("__");

    return NextResponse.json({
      traceId,
      framework: parts[0],
      trace: parts[1],
      turnCount: turns.length,
      turns,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
