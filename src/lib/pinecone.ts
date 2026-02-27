import { Pinecone } from "@pinecone-database/pinecone";

export const EMERGENT_DEMO_SEMANTIC_INDEX_NAME =
  process.env.PINECONE_INDEX_NAME || "agent-traces-semantic";
export const EMERGENT_DEMO_NAMESPACE =
  process.env.PINECONE_NAMESPACE || "traces";
export const EMERGENT_DEMO_HOST = process.env.PINECONE_HOST || "";
export const EMERGENT_DEMO_API_KEY = process.env.PINECONE_API_KEY || "";

let pineconeInstance: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error(
      "PINECONE_API_KEY is not set. Add it to .env.local."
    );
  }

  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }

  return pineconeInstance;
}

export async function resolveNamespace(
  indexName: string,
  requestedNamespace: string
): Promise<string> {
  const pc = getPineconeClient();
  const stats = await pc.index(indexName).describeIndexStats();
  if (!stats.namespaces) return requestedNamespace;

  const nsKey = requestedNamespace === "" ? "__default__" : requestedNamespace;
  if ((stats.namespaces[nsKey]?.recordCount ?? 0) > 0) {
    return requestedNamespace;
  }

  const best = Object.entries(stats.namespaces)
    .filter(([, v]) => (v.recordCount ?? 0) > 0)
    .sort((a, b) => (b[1].recordCount ?? 0) - (a[1].recordCount ?? 0))[0];

  if (!best) return requestedNamespace;
  return best[0] === "__default__" ? "" : best[0];
}
