import { NextResponse } from "next/server";
import { getPineconeClient, resolveNamespace } from "@/lib/pinecone";
import { PROBES } from "@/lib/explore-probes";

const DEFAULT_INDEX = "agent-traces-semantic";
const DEFAULT_NAMESPACE = "traces";
const HITS_PER_PROBE = 4;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const indexName = url.searchParams.get("indexName") || DEFAULT_INDEX;
    const namespace = url.searchParams.get("namespace");
    const resolvedNs = namespace ?? await resolveNamespace(indexName, DEFAULT_NAMESPACE);

    const pc = getPineconeClient();
    const idx = pc.index(indexName);
    const ns = idx.namespace(resolvedNs);

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
          const traceId = (fields.trace_id as string) ?? (fields.source_id as string) ?? "";
          const parts = traceId.replace(".json", "").split("__");
          return {
            id: hit._id,
            score: hit._score,
            chunkText: fields.chunk_text as string,
            role: fields.role as string,
            traceId,
            turnIndex: fields.turn_index as number,
            chunkIndex: fields.chunk_index as number,
            framework: (fields.project as string) || parts[0] || "",
            trace: (fields.title as string) || parts[1] || "",
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
