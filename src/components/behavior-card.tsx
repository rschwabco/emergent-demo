"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Bug,
  FlaskConical,
  BookOpen,
  Wrench,
  ShieldAlert,
  Package,
  Gauge,
  CheckCircle2,
  RotateCcw,
  Code2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BEHAVIOR_THEME: Record<string, { icon: LucideIcon; color: string; bg: string; border: string; hoverBg: string }> = {
  "debugging":      { icon: Bug,          color: "text-red-400",    bg: "bg-red-500/10",    border: "border-l-red-500/50",    hoverBg: "hover:bg-red-500/[0.04]" },
  "error-handling": { icon: ShieldAlert,  color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-l-rose-500/50",   hoverBg: "hover:bg-rose-500/[0.04]" },
  "test-failures":  { icon: FlaskConical, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-l-orange-500/50", hoverBg: "hover:bg-orange-500/[0.04]" },
  "reproducing":    { icon: RotateCcw,    color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-l-amber-500/50",  hoverBg: "hover:bg-amber-500/[0.04]" },
  "code-reading":   { icon: BookOpen,     color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-l-sky-500/50",    hoverBg: "hover:bg-sky-500/[0.04]" },
  "refactoring":    { icon: Wrench,       color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-l-blue-500/50",   hoverBg: "hover:bg-blue-500/[0.04]" },
  "api-design":     { icon: Code2,        color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-l-indigo-500/50", hoverBg: "hover:bg-indigo-500/[0.04]" },
  "verification":   { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-l-emerald-500/50", hoverBg: "hover:bg-emerald-500/[0.04]" },
  "performance":    { icon: Gauge,        color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-l-teal-500/50",    hoverBg: "hover:bg-teal-500/[0.04]" },
  "config-deps":    { icon: Package,      color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-l-violet-500/50",  hoverBg: "hover:bg-violet-500/[0.04]" },
};

const DEFAULT_THEME = { icon: Code2, color: "text-muted-foreground", bg: "bg-muted", border: "border-l-muted", hoverBg: "hover:bg-muted/50" };

export interface BehaviorHit {
  id: string;
  score: number;
  chunkText: string;
  role: string;
  traceId: string;
  turnIndex: number;
  chunkIndex: number;
  framework: string;
  trace: string;
}

export interface BehaviorData {
  id: string;
  label: string;
  description: string;
  query: string;
  insight: string;
  hitCount: number;
  seedHitCount?: number;
  expandedQueries?: string[];
  frameworks?: string[];
  hits: BehaviorHit[];
}

export function BehaviorCard({
  behavior,
  onClick,
}: {
  behavior: BehaviorData;
  onClick: (behavior: BehaviorData) => void;
}) {
  const theme = BEHAVIOR_THEME[behavior.id] ?? DEFAULT_THEME;
  const Icon = theme.icon;

  return (
    <Card
      className={`group flex cursor-pointer flex-col border-l-3 ${theme.border} py-4 transition-all ${theme.hoverBg} hover:shadow-md`}
      onClick={() => onClick(behavior)}
    >
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-center gap-2">
          <span className={`${theme.bg} flex size-8 shrink-0 items-center justify-center rounded-lg`}>
            <Icon className={`size-4 ${theme.color}`} />
          </span>
          <CardTitle className="text-base">{behavior.label}</CardTitle>
        </div>
        <CardDescription className="ml-10 text-sm">
          {behavior.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {behavior.frameworks && behavior.frameworks.length > 0 && (
        <div className="ml-10 mt-3 flex flex-wrap gap-1.5">
          {behavior.frameworks.slice(0, 4).map((framework) => (
            <span
              key={framework}
              className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {framework}
            </span>
          ))}
          {behavior.frameworks.length > 4 && (
            <span className="px-1 py-0.5 text-xs text-muted-foreground">
              +{behavior.frameworks.length - 4}
            </span>
          )}
        </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
          <span>
            {behavior.hitCount} chunks
            {behavior.frameworks && <>{" "}&middot; {behavior.frameworks.length} frameworks</>}
          </span>
          <span className="flex items-center gap-1 transition-colors group-hover:text-foreground">
            Explore <ArrowRight className="size-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function BehaviorCardSkeleton() {
  return (
    <Card className="flex flex-col border-l-3 border-l-muted py-4">
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="ml-10 h-4 w-48" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="ml-10 mt-3 flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-16 rounded" />
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between pt-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}
