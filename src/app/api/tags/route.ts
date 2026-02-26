import { NextRequest, NextResponse } from "next/server";
import {
  getPineconeClient,
  EMERGENT_DEMO_SEMANTIC_INDEX_NAME,
  EMERGENT_DEMO_NAMESPACE,
} from "@/lib/pinecone";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, tag, action } = body as {
      recordId: string;
      tag: string;
      action: "add" | "remove";
    };

    if (!recordId || !tag?.trim() || !action) {
      return NextResponse.json(
        { error: "recordId, tag, and action are required" },
        { status: 400 }
      );
    }

    const normalizedTag = tag.trim().toLowerCase();
    const pc = getPineconeClient();
    const idx = pc.index(EMERGENT_DEMO_SEMANTIC_INDEX_NAME);
    const ns = idx.namespace(EMERGENT_DEMO_NAMESPACE);

    // Fetch the current record to get existing tags
    const fetched = await ns.fetch({ ids: [recordId] });
    const record = fetched.records?.[recordId];

    if (!record) {
      return NextResponse.json(
        { error: `Record ${recordId} not found` },
        { status: 404 }
      );
    }

    const metadata = (record.metadata || {}) as Record<string, unknown>;
    const existingTags: string[] = Array.isArray(metadata.tags)
      ? (metadata.tags as string[])
      : [];

    let newTags: string[];
    if (action === "add") {
      if (existingTags.includes(normalizedTag)) {
        return NextResponse.json({ tags: existingTags });
      }
      newTags = [...existingTags, normalizedTag];
    } else {
      newTags = existingTags.filter((t) => t !== normalizedTag);
    }

    // Update just the metadata (no re-embedding needed)
    await ns.update({
      id: recordId,
      metadata: { tags: newTags },
    });

    return NextResponse.json({ tags: newTags });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
