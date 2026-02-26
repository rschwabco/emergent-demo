"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackedJob {
  id: string;
  query: string;
  status: "pending" | "running" | "done" | "error";
  createdAt: number;
  completedAt: number | null;
  hasText: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 2000;

function truncateQuery(q: string, max = 50) {
  if (q.length <= max) return q;
  return q.slice(0, max).trimEnd() + "...";
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

function JobStatusIcon({ status }: { status: TrackedJob["status"] }) {
  switch (status) {
    case "pending":
    case "running":
      return <Loader2 className="size-3.5 animate-spin text-sky-400" />;
    case "done":
      return <CheckCircle2 className="size-3.5 text-emerald-400" />;
    case "error":
      return <AlertCircle className="size-3.5 text-red-400" />;
  }
}

export function SummaryJobTracker() {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/summarize-results?action=list");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      // silently fail
    }
  }, []);

  const dismissJob = useCallback(
    async (jobId: string) => {
      await fetch(
        `/api/summarize-results?action=dismiss&jobId=${encodeURIComponent(jobId)}`
      ).catch(() => {});
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    },
    []
  );

  useEffect(() => {
    fetchJobs();
    pollingRef.current = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchJobs]);

  const hasActive = jobs.some(
    (j) => j.status === "pending" || j.status === "running"
  );

  // Stop polling once nothing is active (restart when jobs change)
  useEffect(() => {
    if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    } else if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(fetchJobs, POLL_INTERVAL_MS);
    }
  }, [hasActive, fetchJobs]);

  if (jobs.length === 0) return null;

  const activeCount = jobs.filter(
    (j) => j.status === "pending" || j.status === "running"
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-lg border-border/60 bg-background/95 backdrop-blur-sm">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-primary size-4" />
            AI Summaries
            {activeCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-sky-500/20 text-[11px] font-semibold tabular-nums text-sky-400">
                {activeCount}
              </span>
            )}
          </span>
          {collapsed ? (
            <ChevronUp className="text-muted-foreground size-4" />
          ) : (
            <ChevronDown className="text-muted-foreground size-4" />
          )}
        </button>

        {!collapsed && (
          <div className="max-h-60 overflow-y-auto border-t px-2 py-1.5">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={cn(
                  "group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors",
                  (job.status === "pending" || job.status === "running") &&
                    "bg-sky-500/5"
                )}
              >
                <span className="mt-0.5 shrink-0">
                  <JobStatusIcon status={job.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {truncateQuery(job.query)}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {job.status === "pending" && "Queued..."}
                    {job.status === "running" && "Generating..."}
                    {job.status === "done" &&
                      `Completed ${timeAgo(job.completedAt!)}`}
                    {job.status === "error" && (job.error ?? "Failed")}
                  </p>
                </div>
                {(job.status === "done" || job.status === "error") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => dismissJob(job.id)}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
