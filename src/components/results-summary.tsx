"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Loader2,
  GitBranch,
  Repeat2,
  PieChart,
  Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultsSummaryProps {
  query: string;
  hits: {
    id: string;
    chunkText: string;
    role: string;
    framework: string;
    trace: string;
    turnIndex: number;
  }[];
}

type SummaryState = "idle" | "loading" | "generating" | "done" | "error";

const POLL_INTERVAL_MS = 1000;

interface SummarySection {
  category: string;
  title: string;
  body: string;
}

const SECTION_THEME: Record<
  string,
  { icon: LucideIcon; color: string; bg: string; accent: string }
> = {
  patterns: {
    icon: GitBranch,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    accent: "border-l-violet-500/40",
  },
  "common behaviors": {
    icon: Repeat2,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    accent: "border-l-sky-500/40",
  },
  distribution: {
    icon: PieChart,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    accent: "border-l-emerald-500/40",
  },
  notable: {
    icon: Lightbulb,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    accent: "border-l-amber-500/40",
  },
};

const DEFAULT_SECTION_THEME = {
  icon: Sparkles,
  color: "text-muted-foreground",
  bg: "bg-muted",
  accent: "border-l-border",
};

function splitHeading(raw: string): { category: string; title: string } {
  const colonIdx = raw.indexOf(":");
  if (colonIdx > 0) {
    return {
      category: raw.slice(0, colonIdx).trim(),
      title: raw.slice(colonIdx + 1).trim(),
    };
  }
  return { category: raw.trim(), title: "" };
}

function parseSections(text: string): SummarySection[] {
  const sectionRegex = /\*\*([^*]+)\*\*\s*:?\s*/g;
  const sections: SummarySection[] = [];
  let lastIndex = 0;
  let lastRaw = "";
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(text)) !== null) {
    if (lastRaw && lastIndex < match.index) {
      const { category, title } = splitHeading(lastRaw);
      sections.push({
        category,
        title,
        body: text.slice(lastIndex, match.index).trim(),
      });
    }
    lastRaw = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (lastRaw) {
    const { category, title } = splitHeading(lastRaw);
    sections.push({
      category,
      title,
      body: text.slice(lastIndex).trim(),
    });
  }

  return sections;
}

function SectionBlock({ section }: { section: SummarySection }) {
  const key = section.category.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const theme = SECTION_THEME[key] ?? DEFAULT_SECTION_THEME;
  const Icon = theme.icon;

  return (
    <div
      className={cn(
        "rounded-lg border-l-3 py-3 pr-3 pl-3.5",
        theme.accent,
        "bg-card/50"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded",
            theme.bg
          )}
        >
          <Icon className={cn("size-3", theme.color)} />
        </span>
        <div className="min-w-0 flex-1">
          <span className={cn("text-[10px] font-semibold tracking-wider uppercase", theme.color)}>
            {section.category}
          </span>
          {section.title && (
            <p className="text-foreground text-sm font-medium leading-snug">
              {section.title}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {section.body}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ResultsSummary({ query, hits }: ResultsSummaryProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<SummaryState>("idle");
  const lastKeyRef = useRef("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      setState("generating");

      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/summarize-results?jobId=${encodeURIComponent(jobId)}`
          );
          if (!res.ok) {
            stopPolling();
            setState("error");
            return;
          }
          const data = await res.json();
          setText(data.text ?? "");

          if (data.status === "done") {
            stopPolling();
            setState("done");
          } else if (data.status === "error") {
            stopPolling();
            setState("error");
          }
        } catch {
          stopPolling();
          setState("error");
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const fetchSummary = useCallback(async () => {
    if (!query.trim() || hits.length === 0) return;

    const key = `${query}|${hits.map((h) => h.id).join(",")}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    stopPolling();
    setText("");
    setState("loading");

    try {
      const res = await fetch("/api/summarize-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          hits: hits.map((h) => ({
            id: h.id,
            chunkText: h.chunkText,
            role: h.role,
            framework: h.framework,
            trace: h.trace,
            turnIndex: h.turnIndex,
          })),
        }),
      });

      if (!res.ok) {
        setState("error");
        return;
      }

      const data = await res.json();

      if (data.cached && data.summary) {
        setText(data.summary);
        setState("done");
        return;
      }

      if (data.jobId) {
        pollJob(data.jobId);
        return;
      }

      setState("error");
    } catch {
      setState("error");
    }
  }, [query, hits, stopPolling, pollJob]);

  useEffect(() => {
    fetchSummary();
    return () => stopPolling();
  }, [fetchSummary, stopPolling]);

  if (state === "idle") return null;
  if (state === "loading") return <ResultsSummarySkeleton />;
  if (state === "error") return null;

  const sections = parseSections(text);
  const hasSections = sections.length > 0;

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-primary/10 flex size-7 items-center justify-center rounded-lg">
            <Sparkles className="text-primary size-4" />
          </span>
          AI Summary
          {state === "generating" && (
            <span className="text-muted-foreground ml-1 flex items-center gap-1.5 text-xs font-normal">
              <Loader2 className="size-3 animate-spin" />
              Analyzing...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasSections ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {sections.map((section, i) => (
              <SectionBlock key={i} section={section} />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {text}
            {state === "generating" && (
              <span className="bg-primary ml-0.5 inline-block size-1.5 animate-pulse rounded-full align-middle" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ResultsSummarySkeleton() {
  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-primary/10 flex size-7 items-center justify-center rounded-lg">
            <Sparkles className="text-primary size-4" />
          </span>
          AI Summary
          <span className="text-muted-foreground ml-1 flex items-center gap-1.5 text-xs font-normal">
            <Loader2 className="size-3 animate-spin" />
            Analyzing results...
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {[
            "border-l-violet-500/40",
            "border-l-sky-500/40",
            "border-l-emerald-500/40",
            "border-l-amber-500/40",
          ].map((borderClass, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border-l-3 py-2.5 pr-3 pl-3.5",
                borderClass
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="ml-7 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
