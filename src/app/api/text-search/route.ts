import { NextRequest, NextResponse } from "next/server";
import { EMERGENT_DEMO_HOST, EMERGENT_DEMO_NAMESPACE, EMERGENT_DEMO_API_KEY } from "@/lib/pinecone";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 10, filters } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; framework?: string };
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = {};
    if (filters?.role) {
      filter[".role"] = { $eq: filters.role };
    }
    if (filters?.framework) {
      filter[".trace_id"] = { $regex: `^${filters.framework}__` };
    }

    const res = await fetch(
      `https://${EMERGENT_DEMO_HOST}/namespaces/${EMERGENT_DEMO_NAMESPACE}/documents/search`,
      {
        method: "POST",
        headers: {
          "Api-Key": EMERGENT_DEMO_API_KEY,
          "Content-Type": "application/json",
          "X-Pinecone-Api-Version": "2026-01.alpha",
        },
        body: JSON.stringify({
          include_fields: ["*"],
          ...(Object.keys(filter).length > 0 && { filter }),
          score_by: [
            {
              type: "query_string",
              query: `.content.text:(${query.trim()})`,
            },
          ],
          top_k: topK,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Pinecone text search failed: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const matches = data.matches || [];

    const hits = matches.map((match: Record<string, unknown>) => {
      const traceId = (match[".trace_id"] as string) || "";
      const parts = traceId.replace(".json", "").split("__");
      const rawTags = match[".tags"] ?? match["tags"];
      return {
        id: match.id,
        score: match.score,
        chunkText: match[".content.text"] || "",
        role: match[".role"] || "",
        traceId,
        turnIndex: match[".turn_index"],
        chunkIndex: match[".content.chunk_index"],
        framework: parts[0],
        trace: parts[1],
        tags: Array.isArray(rawTags) ? rawTags : [],
      };
    });

    return NextResponse.json({ hits });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
