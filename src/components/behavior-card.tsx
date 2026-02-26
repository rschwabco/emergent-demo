"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/role-badge";
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

const BEHAVIOR_THEME: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  "debugging":     { icon: Bug,          color: "text-red-400",     bg: "bg-red-500/10",     border: "border-l-red-500/50" },
  "test-failures": { icon: FlaskConical, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-l-amber-500/50" },
  "code-reading":  { icon: BookOpen,     color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-l-sky-500/50" },
  "refactoring":   { icon: Wrench,       color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-l-violet-500/50" },
  "error-handling":{ icon: ShieldAlert,  color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-l-orange-500/50" },
  "config-deps":   { icon: Package,      color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-l-teal-500/50" },
  "performance":   { icon: Gauge,        color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-l-emerald-500/50" },
  "verification":  { icon: CheckCircle2, color: "text-green-400",   bg: "bg-green-500/10",   border: "border-l-green-500/50" },
  "reproducing":   { icon: RotateCcw,    color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-l-pink-500/50" },
  "api-design":    { icon: Code2,        color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-l-indigo-500/50" },
};

const DEFAULT_THEME = { icon: Code2, color: "text-muted-foreground", bg: "bg-muted", border: "border-l-muted" };

function truncate(text: string, maxLen = 120) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

interface BehaviorHit {
  id: unknown;
  score: unknown;
  chunkText: string;
  role: string;
  traceId: string;
  turnIndex: number;
  chunkIndex: number;
  project: string;
  issue: string;
}

export interface BehaviorData {
  id: string;
  label: string;
  description: string;
  query: string;
  insight: string;
  hitCount: number;
  projects: string[];
  topHits: BehaviorHit[];
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
      className={`group cursor-pointer border-l-3 ${theme.border} py-4 transition-colors hover:border-ring/50`}
      onClick={() => onClick(behavior)}
    >
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`${theme.bg} flex size-7 shrink-0 items-center justify-center rounded-lg`}>
              <Icon className={`size-4 ${theme.color}`} />
            </span>
            <CardTitle className="text-sm">{behavior.label}</CardTitle>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {behavior.hitCount} chunks
          </Badge>
        </div>
        <CardDescription className="ml-9 text-xs">
          {behavior.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {behavior.insight && (
          <p className="text-foreground/80 ml-9 mt-1 text-xs font-medium italic leading-relaxed">
            &ldquo;{behavior.insight}&rdquo;
          </p>
        )}

        <div className="ml-9 mt-2 flex flex-wrap gap-1">
          {behavior.projects.slice(0, 5).map((project) => (
            <span
              key={project}
              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
            >
              {project}
            </span>
          ))}
          {behavior.projects.length > 5 && (
            <span className="text-muted-foreground text-[10px]">
              +{behavior.projects.length - 5}
            </span>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          {behavior.topHits.slice(0, 2).map((hit) => (
            <div
              key={String(hit.id)}
              className="bg-muted/40 rounded-md px-3 py-2 text-xs"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <RoleBadge role={hit.role} />
                <span className="text-muted-foreground">
                  {hit.project}/{hit.issue}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {truncate(hit.chunkText)}
              </p>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground mt-3 flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          Explore pattern <ArrowRight className="size-3" />
        </div>
      </CardContent>
    </Card>
  );
}

export function BehaviorCardSkeleton() {
  return (
    <Card className="border-l-3 border-l-muted py-4">
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="ml-9 h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="ml-9 mt-1 h-8 w-full" />
        <div className="ml-9 mt-2 flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-14 rounded" />
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-muted/40 rounded-md px-3 py-2">
              <Skeleton className="mb-1 h-3 w-24" />
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
