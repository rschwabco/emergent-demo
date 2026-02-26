import { NextRequest, NextResponse } from "next/server";
import { getPineconeClient, resolveNamespace } from "@/lib/pinecone";

const DEFAULT_INDEX = "agent-traces";
const DEFAULT_NAMESPACE = "traces";
const CONTENT_TEXT_FIELD = ".content.text";
const DOCUMENTS_API_VERSION = "2026-01.alpha";

const docSearchHostCache = new Map<string, string>();

async function getIndexHost(idxName: string): Promise<string> {
  const cached = docSearchHostCache.get(idxName);
  if (cached) return cached;
  const pc = getPineconeClient();
  const desc = await pc.describeIndex(idxName);
  docSearchHostCache.set(idxName, desc.host);
  return desc.host;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 10, filters, field, indexName, namespace } = body as {
      query: string;
      topK?: number;
      filters?: { role?: string; project?: string };
      field?: string;
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
    const ns = namespace ?? await resolveNamespace(idxName, DEFAULT_NAMESPACE);
    const host = await getIndexHost(idxName);
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PINECONE_API_KEY is not set" },
        { status: 500 }
      );
    }

    const searchField = field || CONTENT_TEXT_FIELD;
    const luceneQuery = `${searchField}:(${query.trim()})`;

    const filter: Record<string, unknown> = {};
    if (filters?.role) {
      filter[".role"] = { $eq: filters.role };
    }
    if (filters?.project) {
      filter[".trace_id"] = { $regex: `^${filters.project}__` };
    }

    const requestBody: Record<string, unknown> = {
      top_k: topK,
      score_by: [{ type: "query_string", query: luceneQuery }],
      include_fields: ["*"],
    };
    if (Object.keys(filter).length > 0) {
      requestBody.filter = filter;
    }

    const res = await fetch(
      `https://${host}/namespaces/${ns}/documents/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
          "X-Pinecone-Api-Version": DOCUMENTS_API_VERSION,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Pinecone API error (${res.status}): ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    const hits = (data.matches ?? []).map(
      (match: Record<string, unknown>) => {
        const traceId = (match[".trace_id"] as string) ?? (match[".source_id"] as string) ?? "";
        const parts = traceId.replace(".json", "").split("__");
        return {
          id: match.id,
          score: match.score,
          chunkText: match[".content.text"] ?? "",
          role: match[".role"] ?? "unknown",
          traceId,
          turnIndex: match[".turn_index"] ?? 0,
          chunkIndex: match[".content.chunk_index"] ?? 0,
          project: (match[".project"] as string) || parts[0] || "",
          issue: (match[".title"] as string) || parts[1] || "",
          tags: [],
        };
      }
    );

    return NextResponse.json({
      hits,
      usage: data.usage,
      matchCount: data.matches?.length ?? 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
