"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TraceConversation, type Turn } from "@/components/trace-conversation";
import { ArrowLeft } from "lucide-react";

interface TraceData {
  traceId: string;
  project: string;
  issue: string;
  turnCount: number;
  turns: Turn[];
}

export default function TracePage() {
  const params = useParams<{ traceId: string }>();
  const searchParams = useSearchParams();
  const highlightTurn = searchParams.get("turn")
    ? Number(searchParams.get("turn"))
    : undefined;
  const indexName = searchParams.get("indexName") || "agent-traces-semantic";

  const [data, setData] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.traceId) return;

    setLoading(true);
    setError(null);

    const qs = indexName ? `?indexName=${encodeURIComponent(indexName)}` : "";
    fetch(`/api/trace/${encodeURIComponent(params.traceId)}${qs}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.traceId]);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <Link
        href={`/index/${encodeURIComponent(indexName)}`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Explore Topics
      </Link>

      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight">
          {data
            ? `${data.project}/${data.issue}`
            : params.traceId?.replace(".json", "")}
        </h1>
        {data && (
          <p className="text-muted-foreground text-xs">
            {data.turnCount} turns in conversation
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <TraceConversation
        turns={data?.turns ?? []}
        highlightTurn={highlightTurn}
        loading={loading}
      />
    </div>
  );
}
