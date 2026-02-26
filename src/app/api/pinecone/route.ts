import { NextRequest, NextResponse } from "next/server";
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

export async function DELETE(req: NextRequest) {
  try {
    const { indexName } = await req.json();
    if (!indexName || typeof indexName !== "string") {
      return NextResponse.json(
        { error: "indexName is required" },
        { status: 400 }
      );
    }

    const pc = getPineconeClient();
    await pc.deleteIndex(indexName);

    return NextResponse.json({ deleted: indexName });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
