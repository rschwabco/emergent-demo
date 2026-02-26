import { NextResponse } from "next/server";
import { getPineconeClient, EMERGENT_DEMO_SEMANTIC_INDEX_NAME, EMERGENT_DEMO_NAMESPACE } from "@/lib/pinecone";
import { PROBES } from "@/lib/explore-probes";
const HITS_PER_PROBE = 4;

export async function GET() {
  try {
    const pc = getPineconeClient();
    const idx = pc.index(EMERGENT_DEMO_SEMANTIC_INDEX_NAME);
    const ns = idx.namespace(EMERGENT_DEMO_NAMESPACE);

    const probeResults = await Promise.all(
      PROBES.map(async (probe) => {
        const results = await ns.searchRecords({
          query: {
            topK: HITS_PER_PROBE,
            inputs: { text: probe.query },
          },
        });
        return { probe, hits: results.result.hits };
      })
    );

    const seenIds = new Set<string>();

    const topics = probeResults.map(({ probe, hits }) => {
      const dedupedHits = hits
        .filter((hit) => {
          if (seenIds.has(hit._id as string)) return false;
          seenIds.add(hit._id as string);
          return true;
        })
        .map((hit) => {
          const fields = hit.fields as Record<string, unknown>;
          const traceId = fields.trace_id as string;
          const parts = traceId.replace(".json", "").split("__");
          return {
            id: hit._id,
            score: hit._score,
            chunkText: fields.chunk_text as string,
            role: fields.role as string,
            traceId,
            turnIndex: fields.turn_index as number,
            chunkIndex: fields.chunk_index as number,
            project: parts[0],
            issue: parts[1],
            tags: Array.isArray(fields.tags) ? fields.tags
              : Array.isArray(fields[".tags"]) ? fields[".tags"]
              : [],
          };
        });

      return {
        id: probe.id,
        label: probe.label,
        description: probe.description,
        query: probe.query,
        hits: dedupedHits,
      };
    });

    return NextResponse.json(
      { topics },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
