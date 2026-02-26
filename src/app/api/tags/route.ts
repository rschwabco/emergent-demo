import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

const INDEX_NAME = "agent-traces-semantic";
const NAMESPACE = "traces";

export async function GET() {
  try {
    const pc = getPineconeClient();
    const idx = pc.index(INDEX_NAME);

    const response = await idx.fetchByMetadata({
      filter: { tags: { $exists: true } },
      limit: 1000,
      namespace: NAMESPACE,
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
    const { updates } = body as {
      updates: Array<{ id: string; tags: string[] }>;
    };

    if (!updates?.length) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    const pc = getPineconeClient();
    const idx = pc.index(INDEX_NAME);

    await Promise.all(
      updates.map((u) =>
        idx.update({
          id: u.id,
          metadata: { tags: u.tags },
          namespace: NAMESPACE,
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
