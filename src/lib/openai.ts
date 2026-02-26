import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local or your Vercel environment variables."
    );
  }

  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiInstance;
}
