import { Pinecone } from "@pinecone-database/pinecone";

let pineconeInstance: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error(
      "PINECONE_API_KEY is not set. Add it to .env.local or your Vercel environment variables."
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
