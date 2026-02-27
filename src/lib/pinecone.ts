import { Pinecone } from "@pinecone-database/pinecone";
import envConfig from "@/../env.json";

export const EMERGENT_DEMO_SEMANTIC_INDEX_NAME = envConfig.semantic_index_name;
export const EMERGENT_DEMO_NAMESPACE = envConfig.namespace;
export const EMERGENT_DEMO_HOST = envConfig.host;
export const EMERGENT_DEMO_API_KEY = envConfig.pinecone_api_key;

let pineconeInstance: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!envConfig.pinecone_api_key) {
    throw new Error(
      "pinecone_api_key is not set in env.json."
    );
  }

  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({
      apiKey: envConfig.pinecone_api_key,
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
