import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient, resolveNamespace } from "@/lib/pinecone";

const DEFAULT_INDEX = "agent-traces-semantic";
const DEFAULT_NAMESPACE = "traces";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const indexName = url.searchParams.get("indexName") || DEFAULT_INDEX;
    const namespace = url.searchParams.get("namespace");
    const resolvedNs = namespace ?? await resolveNamespace(indexName, DEFAULT_NAMESPACE);

    const pc = getPineconeClient();
    const idx = pc.index(indexName);

    const response = await idx.fetchByMetadata({
      filter: { tags: { $exists: true } },
      limit: 1000,
      namespace: resolvedNs,
    });

    const tagSet = new Set<string>();
    for (const record of Object.values(response.records)) {
      const meta = record.metadata as Record<string, unknown>;
      const rawTags = meta.tags;
      if (Array.isArray(rawTags)) {
        for (const t of rawTags) {
          if (typeof t === "string" && t.length > 0) tagSet.add(t);
        }
      }
    }

    return NextResponse.json({ tags: [...tagSet].sort() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates, indexName, namespace } = body as {
      updates: Array<{ id: string; tags: string[] }>;
      indexName?: string;
      namespace?: string;
    };

    if (!updates?.length) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    const idxName = indexName || DEFAULT_INDEX;
    const resolvedNs = namespace ?? await resolveNamespace(idxName, DEFAULT_NAMESPACE);
    const pc = getPineconeClient();
    const idx = pc.index(idxName);

    await Promise.all(
      updates.map((u) =>
        idx.update({
          id: u.id,
          metadata: { tags: u.tags },
          namespace: resolvedNs,
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
