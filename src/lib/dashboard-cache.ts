import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "dashboard.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function getCachedDashboard<T>(): Promise<T | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setCachedDashboard<T>(data: T): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await writeFile(CACHE_FILE, JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.error("Failed to write dashboard cache:", err);
  }
}
