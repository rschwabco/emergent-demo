"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, FolderOpen } from "lucide-react";

const PROJECT_COLORS: Record<string, { dot: string; text: string }> = {
  django:         { dot: "bg-emerald-500", text: "text-emerald-400" },
  pallets:        { dot: "bg-teal-500",    text: "text-teal-400" },
  "scikit-learn": { dot: "bg-sky-500",     text: "text-sky-400" },
  matplotlib:     { dot: "bg-blue-500",    text: "text-blue-400" },
  pydata:         { dot: "bg-indigo-500",  text: "text-indigo-400" },
  mwaskom:        { dot: "bg-cyan-500",    text: "text-cyan-400" },
  sympy:          { dot: "bg-violet-500",  text: "text-violet-400" },
  astropy:        { dot: "bg-purple-500",  text: "text-purple-400" },
  "pytest-dev":   { dot: "bg-amber-500",   text: "text-amber-400" },
  "sphinx-doc":   { dot: "bg-orange-500",  text: "text-orange-400" },
  psf:            { dot: "bg-slate-500",   text: "text-slate-400" },
};

const DEFAULT_COLOR = { dot: "bg-muted-foreground", text: "text-muted-foreground" };

interface ProjectHit {
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

export interface ProjectData {
  name: string;
  narrative: string;
  topBehaviors: string[];
  hitCount: number;
  topHit: ProjectHit;
}

export function ProjectBreakdown({
  projects,
  onProjectClick,
}: {
  projects: ProjectData[];
  onProjectClick?: (projectName: string) => void;
}) {
  if (projects.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-emerald-500/10 flex size-7 items-center justify-center rounded-lg">
          <FolderOpen className="size-4 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          By Project
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {projects.map((project) => {
          const colors = PROJECT_COLORS[project.name] ?? DEFAULT_COLOR;
          return (
            <button
              key={project.name}
              onClick={() => onProjectClick?.(project.name)}
              className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-all hover:bg-white/[0.03] dark:hover:bg-white/[0.04] hover:shadow-md"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${colors.dot}`} />
              <span className={`flex-1 text-sm font-medium capitalize ${colors.text}`}>
                {project.name}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {project.hitCount}
              </span>
              <ArrowRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectBreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
