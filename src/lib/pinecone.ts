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
