import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function cacheFilePath(keyPrefix?: string): string {
  const safeName = (keyPrefix || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `dashboard-${safeName}.json`);
}

export async function getCachedDashboard<T>(keyPrefix?: string): Promise<T | null> {
  try {
    const raw = await readFile(cacheFilePath(keyPrefix), "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setCachedDashboard<T>(data: T, keyPrefix?: string): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await writeFile(cacheFilePath(keyPrefix), JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.error("Failed to write dashboard cache:", err);
  }
}
