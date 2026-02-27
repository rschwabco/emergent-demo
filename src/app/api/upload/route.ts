import { NextRequest } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;
const UPSERT_BATCH_SIZE = 50;

interface TranscriptDoc {
  id: string;
  title?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

interface TurnChunk {
  text: string;
  role: string;
  turnIndex: number;
}

type ChunkRecord = Record<string, string | number | boolean> & {
  _id: string;
  chunk_text: string;
};

function isTranscriptFormat(text: string): boolean {
  return /^### (User|Assistant)\b/m.test(text) &&
    (text.match(/^### (User|Assistant)/gm)?.length ?? 0) >= 2;
}

const THINKING_PATTERNS = [
  /^(?:Let me|I'm thinking|I'm realizing|I'm reconsidering|I'm seeing|I'm leaning|I'm wondering|I'm settling|I'm weighing|I'm planning|I'm considering|I need to|I should|I'll |Now I'm|Now let me|Now I need|Now I have|Actually,|Hmm,|Wait,|Looking at|Searching for|Reading |Checking |Exploring |Good,? |Implementing|Writing |Modifying|Continuing|Restructuring|Refining)/i,
  /^The (?:user|issue|problem|fix|real|core|main|approach|idea|challenge|tradeoff|simplest|cleanest|better|best) /i,
  /^(?:I can see|I notice|I see the|I also need|I have a|For the |For each |Here's (?:what|how|my|the)|My plan|So (?:the|I|we)|This (?:is (?:a|essentially|exactly)|means|happens|gives|would))/i,
  /^(?:Pro:|Con:|- Pro:|- Con:)/,
  /^Option \d+:/,
];

function isThinkingParagraph(para: string): boolean {
  const trimmed = para.trim();
  if (!trimmed) return true;
  return THINKING_PATTERNS.some((p) => p.test(trimmed));
}

function cleanAssistantBlock(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  const kept = paragraphs.filter((p) => !isThinkingParagraph(p));
  return kept.join("\n\n").trim();
}

function stripSubagentBlocks(text: string): string {
  return text.replace(/---\s*Subagent Task\s*---[\s\S]*?---\s*End Subagent\s*---/g, "").trim();
}

function parseTranscriptTurns(text: string): TurnChunk[] {
  const cleaned = stripSubagentBlocks(text);
  const parts = cleaned.split(/^(### (?:User|Assistant))\s*$/m);
  const turns: TurnChunk[] = [];
  let turnIndex = 0;
  let lastRole = "";
  let pendingContent = "";

  for (let i = 1; i < parts.length; i += 2) {
    const marker = parts[i];
    const content = (parts[i + 1] ?? "").trim();
    const role = marker.includes("User") ? "user" : "assistant";

    if (role === "assistant") {
      const cleaned = cleanAssistantBlock(content);
      if (!cleaned) continue;

      if (lastRole === "assistant") {
        pendingContent += "\n\n" + cleaned;
        continue;
      }
      if (pendingContent && lastRole) {
        turns.push({ text: pendingContent, role: lastRole, turnIndex });
        turnIndex++;
      }
      pendingContent = cleaned;
      lastRole = role;
    } else {
      if (pendingContent && lastRole) {
        turns.push({ text: pendingContent, role: lastRole, turnIndex });
        turnIndex++;
      }
      pendingContent = content;
      lastRole = role;
    }
  }
  if (pendingContent && lastRole) {
    turns.push({ text: pendingContent, role: lastRole, turnIndex });
  }

  return turns.filter((t) => t.text.length > 20);
}

function chunkText(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  if (text.length <= chunkSize) {
    chunks.push(text);
    return chunks;
  }

  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      const slice = text.slice(start, end);
      let lastBreak = slice.lastIndexOf("\n\n");
      if (lastBreak === -1) lastBreak = slice.lastIndexOf("\n");
      if (lastBreak === -1) lastBreak = slice.lastIndexOf(". ");
      if (lastBreak > chunkSize * 0.5) {
        end = start + lastBreak + 1;
      }
    } else {
      end = text.length;
    }

    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks.filter((c) => c.length > 0);
}

function parseDocuments(raw: string): TranscriptDoc[] {
  const docs: TranscriptDoc[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.text && typeof obj.text === "string") {
        docs.push({
          id: obj.id || crypto.randomUUID(),
          title: obj.title || "",
          text: obj.text,
          metadata: obj.metadata || {},
        });
      }
    } catch {
      continue;
    }
  }
  return docs;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const indexName = formData.get("indexName") as string | null;
        const namespace = (formData.get("namespace") as string) || "";
        const frameworkName = (formData.get("frameworkName") as string) || "";
        const chunkSize = Number(formData.get("chunkSize")) || CHUNK_SIZE;
        const chunkOverlap =
          Number(formData.get("chunkOverlap")) || CHUNK_OVERLAP;

        if (!file) {
          send({ type: "error", message: "No file provided" });
          controller.close();
          return;
        }
        if (!indexName?.trim()) {
          send({ type: "error", message: "Index name is required" });
          controller.close();
          return;
        }

        send({ type: "status", message: "Reading file…" });
        const raw = await file.text();
        const docs = parseDocuments(raw);

        if (docs.length === 0) {
          send({
            type: "error",
            message:
              'No valid documents found. Each line must be JSON with a "text" field.',
          });
          controller.close();
          return;
        }

        const hasTranscripts = docs.some((d) => isTranscriptFormat(d.text));
        send({
          type: "status",
          message: hasTranscripts
            ? `Parsed ${docs.length} documents (transcript format detected — cleansing & turn-chunking). Chunking…`
            : `Parsed ${docs.length} documents. Chunking…`,
        });

        const allChunks: ChunkRecord[] = [];
        for (const doc of docs) {
          const useTranscriptMode = isTranscriptFormat(doc.text);

          if (useTranscriptMode) {
            const turns = parseTranscriptTurns(doc.text);
            let chunkIdx = 0;
            for (const turn of turns) {
              const subChunks = chunkText(turn.text, chunkSize, chunkOverlap);
              for (let j = 0; j < subChunks.length; j++) {
                const record: ChunkRecord = {
                  _id: `${doc.id}__turn_${turn.turnIndex}__chunk_${j}`,
                  chunk_text: subChunks[j],
                  source_id: doc.id,
                  title: doc.title || "",
                  role: turn.role,
                  turn_index: turn.turnIndex,
                  chunk_index: chunkIdx,
                  total_chunks: 0,
                  source: "jsonl_upload",
                  ...(frameworkName && { project: frameworkName }),
                };
                if (doc.metadata) {
                  for (const [key, value] of Object.entries(doc.metadata)) {
                    if (
                      key !== "_id" &&
                      key !== "chunk_text" &&
                      key !== "role" &&
                      key !== "turn_index" &&
                      (typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean")
                    ) {
                      record[key] = value;
                    }
                  }
                }
                allChunks.push(record);
                chunkIdx++;
              }
            }
            const docChunks = allChunks.filter(
              (c) => c.source_id === doc.id
            );
            for (const c of docChunks) c.total_chunks = docChunks.length;
          } else {
            const chunks = chunkText(doc.text, chunkSize, chunkOverlap);
            for (let i = 0; i < chunks.length; i++) {
              const record: ChunkRecord = {
                _id: `${doc.id}__chunk_${i}`,
                chunk_text: chunks[i],
                source_id: doc.id,
                title: doc.title || "",
                chunk_index: i,
                total_chunks: chunks.length,
                source: "jsonl_upload",
                ...(frameworkName && { project: frameworkName }),
              };
              if (doc.metadata) {
                for (const [key, value] of Object.entries(doc.metadata)) {
                  if (
                    key !== "_id" &&
                    key !== "chunk_text" &&
                    (typeof value === "string" ||
                      typeof value === "number" ||
                      typeof value === "boolean")
                  ) {
                    record[key] = value;
                  }
                }
              }
              allChunks.push(record);
            }
          }
        }

        send({
          type: "chunked",
          message: `Created ${allChunks.length} chunks from ${docs.length} documents`,
          totalChunks: allChunks.length,
          totalDocs: docs.length,
        });

        const pc = getPineconeClient();
        const { indexes } = await pc.listIndexes();
        const existing = indexes?.find((ix) => ix.name === indexName);

        if (!existing) {
          send({
            type: "status",
            message: `Index "${indexName}" not found — creating it…`,
          });
          await pc.createIndexForModel({
            name: indexName,
            cloud: "aws",
            region: "us-east-1",
            embed: {
              model: "multilingual-e5-large",
              fieldMap: { text: "chunk_text" },
            },
            waitUntilReady: true,
          });
          send({
            type: "status",
            message: `Index "${indexName}" created and ready.`,
          });
        } else if (existing.status?.state !== "Ready") {
          send({
            type: "status",
            message: `Index "${indexName}" exists but is initializing — waiting…`,
          });
          let ready = false;
          for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise((r) => setTimeout(r, 2000));
            const desc = await pc.describeIndex(indexName);
            if (desc.status?.state === "Ready") {
              ready = true;
              break;
            }
          }
          if (!ready) {
            send({ type: "error", message: `Index "${indexName}" did not become ready in time.` });
            controller.close();
            return;
          }
          send({ type: "status", message: `Index "${indexName}" is ready.` });
        }

        const idx = pc.index(indexName);
        const ns = namespace ? idx.namespace(namespace) : idx.namespace("");

        const totalBatches = Math.ceil(allChunks.length / UPSERT_BATCH_SIZE);
        let upsertedCount = 0;

        for (let i = 0; i < allChunks.length; i += UPSERT_BATCH_SIZE) {
          const batch = allChunks.slice(i, i + UPSERT_BATCH_SIZE);
          const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;

          send({
            type: "progress",
            message: `Upserting batch ${batchNum}/${totalBatches}…`,
            batch: batchNum,
            totalBatches,
            upserted: upsertedCount,
            total: allChunks.length,
            progress: Math.round((upsertedCount / allChunks.length) * 100),
          });

          await ns.upsertRecords({ records: batch });
          upsertedCount += batch.length;
        }

        send({
          type: "complete",
          message: `Successfully uploaded ${upsertedCount} chunks from ${docs.length} documents to "${indexName}"`,
          upserted: upsertedCount,
          totalDocs: docs.length,
          index: indexName,
          namespace: namespace || "(default)",
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
