import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

const INDEX_NAME = "agent-traces-semantic";
const NAMESPACE = "traces";

export async function POST(request: NextRequest) {
  try {
    const { traceId, turnIndex, radius = 2 } = (await request.json()) as {
      traceId: string;
      turnIndex: number;
      radius?: number;
    };

    if (!traceId || turnIndex == null) {
      return NextResponse.json(
        { error: "traceId and turnIndex are required" },
        { status: 400 }
      );
    }

    const pc = getPineconeClient();
    const idx = pc.index(INDEX_NAME);
    const ns = idx.namespace(NAMESPACE);

    const minTurn = Math.max(0, turnIndex - radius);
    const maxTurn = turnIndex + radius;

    const results = await ns.searchRecords({
      query: {
        topK: 10000,
        inputs: { text: traceId },
        filter: {
          $and: [
            { trace_id: { $eq: traceId } },
            { turn_index: { $gte: minTurn } },
            { turn_index: { $lte: maxTurn } },
          ],
        },
      },
    });

    const chunks = results.result.hits.map((hit) => {
      const f = hit.fields as Record<string, unknown>;
      return {
        turnIndex: f.turn_index as number,
        chunkIndex: f.chunk_index as number,
        role: f.role as string,
        text: f.chunk_text as string,
      };
    });

    chunks.sort(
      (a, b) => a.turnIndex - b.turnIndex || a.chunkIndex - b.chunkIndex
    );

    const turns: { turnIndex: number; role: string; text: string }[] = [];
    let current: (typeof turns)[number] | null = null;

    for (const chunk of chunks) {
      if (!current || current.turnIndex !== chunk.turnIndex) {
        if (current) turns.push(current);
        current = {
          turnIndex: chunk.turnIndex,
          role: chunk.role,
          text: chunk.text,
        };
      } else {
        current.text += chunk.text;
      }
    }
    if (current) turns.push(current);

    return NextResponse.json({ traceId, turnIndex, turns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
