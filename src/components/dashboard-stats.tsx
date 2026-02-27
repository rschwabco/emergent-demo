"use client";

import { Card } from "@/components/ui/card";
import { Database, FolderOpen, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface DashboardStatsProps {
  totalChunks: number;
  frameworkCount?: number;
  behaviorCount: number;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

interface StatConfig {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export function DashboardStats({
  totalChunks,
  frameworkCount,
  behaviorCount,
}: DashboardStatsProps) {
  const stats: StatConfig[] = [
    { label: "Chunks Indexed", value: formatNumber(totalChunks), icon: Database, color: "text-sky-400", bg: "bg-sky-500/10" },
    ...(frameworkCount ? [{ label: "Frameworks", value: String(frameworkCount), icon: FolderOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" }] : []),
    { label: "Behavior Patterns", value: String(behaviorCount), icon: Layers, color: "text-violet-400", bg: "bg-violet-500/10" },
  ];

  return (
    <div className={`grid gap-3 ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {stats.map((stat) => (
        <Card key={stat.label} className="flex items-center gap-3 px-4 py-3">
          <div className={`${stat.bg} flex size-9 shrink-0 items-center justify-center rounded-lg`}>
            <stat.icon className={`size-4.5 ${stat.color}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums leading-tight">{stat.value}</span>
            <span className="text-muted-foreground text-xs">{stat.label}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}
