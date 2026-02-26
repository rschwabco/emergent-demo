import { randomUUID } from "crypto";

export type JobStatus = "pending" | "running" | "done" | "error";

export interface SummaryJob {
  id: string;
  query: string;
  cacheKey: string;
  status: JobStatus;
  text: string;
  createdAt: number;
  completedAt: number | null;
  error: string | null;
}

const jobs = new Map<string, SummaryJob>();

const MAX_AGE_MS = 30 * 60 * 1000; // auto-evict after 30 min

function evictStale() {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

export function createJob(query: string, cacheKey: string): SummaryJob {
  evictStale();
  const job: SummaryJob = {
    id: randomUUID(),
    query,
    cacheKey,
    status: "pending",
    text: "",
    createdAt: Date.now(),
    completedAt: null,
    error: null,
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): SummaryJob | undefined {
  return jobs.get(id);
}

export function findJobByCacheKey(cacheKey: string): SummaryJob | undefined {
  for (const job of jobs.values()) {
    if (job.cacheKey === cacheKey && (job.status === "pending" || job.status === "running")) {
      return job;
    }
  }
  return undefined;
}

export function appendToJob(id: string, delta: string) {
  const job = jobs.get(id);
  if (job) {
    job.status = "running";
    job.text += delta;
  }
}

export function completeJob(id: string) {
  const job = jobs.get(id);
  if (job) {
    job.status = "done";
    job.completedAt = Date.now();
  }
}

export function failJob(id: string, error: string) {
  const job = jobs.get(id);
  if (job) {
    job.status = "error";
    job.error = error;
    job.completedAt = Date.now();
  }
}

export function getAllActiveJobs(): SummaryJob[] {
  evictStale();
  return [...jobs.values()].filter(
    (j) => j.status === "pending" || j.status === "running"
  );
}

export function getRecentJobs(limit = 10): SummaryJob[] {
  evictStale();
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function dismissJob(id: string) {
  jobs.delete(id);
}
