"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  TrendingUp,
  Eye,
  Zap,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const INSIGHT_STYLES: {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}[] = [
  { icon: Sparkles, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { icon: Eye, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  { icon: Zap, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Target, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
];

interface CrossCuttingInsightsProps {
  insights: string[];
}

export function CrossCuttingInsights({ insights }: CrossCuttingInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 flex size-7 items-center justify-center rounded-lg">
          <Sparkles className="text-primary size-4" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Key Findings</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, i) => {
          const style = INSIGHT_STYLES[i % INSIGHT_STYLES.length];
          const Icon = style.icon;
          return (
            <Card
              key={i}
              className={`border ${style.border} py-3 transition-colors hover:border-ring/30`}
            >
              <CardHeader className="pb-0">
                <CardTitle className="flex items-start gap-2.5 text-sm font-medium leading-snug">
                  <span className={`${style.bg} mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md`}>
                    <Icon className={`size-3.5 ${style.color}`} />
                  </span>
                  <span className="text-foreground/90">{insight}</span>
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function CrossCuttingInsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="py-3">
            <CardHeader className="pb-0">
              <div className="flex items-start gap-2.5">
                <Skeleton className="mt-0.5 size-6 shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
