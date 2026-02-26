import { NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

export async function GET() {
  try {
    const pc = getPineconeClient();
    const { indexes } = await pc.listIndexes();

    return NextResponse.json({ indexes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
