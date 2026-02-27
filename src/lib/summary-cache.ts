import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "summaries.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface SummaryCacheEntry {
  summary: string;
  timestamp: number;
}

type SummaryCache = Record<string, SummaryCacheEntry>;

export function buildCacheKey(query: string, hitIds: string[]): string {
  const normalized = query.toLowerCase().trim();
  const sortedIds = [...hitIds].sort().join(",");
  const hash = createHash("sha256")
    .update(`${normalized}|${sortedIds}`)
    .digest("hex")
    .slice(0, 16);
  return hash;
}

async function readCacheFile(): Promise<SummaryCache> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as SummaryCache;
  } catch {
    return {};
  }
}

export async function getCachedSummary(key: string): Promise<string | null> {
  const cache = await readCacheFile();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }
  return entry.summary;
}

export async function setCachedSummary(
  key: string,
  summary: string
): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const cache = await readCacheFile();

    // Evict expired entries while we're at it
    const now = Date.now();
    for (const k of Object.keys(cache)) {
      if (now - cache[k].timestamp > CACHE_TTL_MS) {
        delete cache[k];
      }
    }

    cache[key] = { summary, timestamp: now };
    await writeFile(CACHE_FILE, JSON.stringify(cache), "utf-8");
  } catch (err) {
    console.error("Failed to write summary cache:", err);
  }
}
