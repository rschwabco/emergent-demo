import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You rewrite search queries for a corpus of AI coding agent conversation traces from SWE-bench (projects: django, scikit-learn, matplotlib, pytest-dev, sympy, astropy, sphinx-doc, pallets).

Given a query, produce 2 alternative phrasings that would retrieve complementary results. Focus on vocabulary variation, synonyms, and different angles of the same intent.

Return ONLY a JSON array of 2 strings. No explanation, no markdown.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body as { query: string };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query.trim() },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let rewrites: string[];
    try {
      const parsed = JSON.parse(raw);
      rewrites = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string").slice(0, 2)
        : [];
    } catch {
      rewrites = [];
    }

    return NextResponse.json({ rewrites });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
