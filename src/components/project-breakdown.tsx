"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/role-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen } from "lucide-react";

const PROJECT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  django:         { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
  "scikit-learn": { bg: "bg-sky-500/10",     text: "text-sky-400",     dot: "bg-sky-500" },
  matplotlib:     { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-500" },
  "pytest-dev":   { bg: "bg-rose-500/10",    text: "text-rose-400",    dot: "bg-rose-500" },
  sympy:          { bg: "bg-violet-500/10",  text: "text-violet-400",  dot: "bg-violet-500" },
  astropy:        { bg: "bg-indigo-500/10",  text: "text-indigo-400",  dot: "bg-indigo-500" },
  "sphinx-doc":   { bg: "bg-teal-500/10",    text: "text-teal-400",    dot: "bg-teal-500" },
  pallets:        { bg: "bg-orange-500/10",  text: "text-orange-400",  dot: "bg-orange-500" },
  pydata:         { bg: "bg-pink-500/10",    text: "text-pink-400",    dot: "bg-pink-500" },
  psf:            { bg: "bg-cyan-500/10",    text: "text-cyan-400",    dot: "bg-cyan-500" },
  mwaskom:        { bg: "bg-lime-500/10",    text: "text-lime-400",    dot: "bg-lime-500" },
};

const DEFAULT_COLOR = { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };

function truncate(text: string, maxLen = 100) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

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
}: {
  projects: ProjectData[];
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {projects.map((project) => {
          const colors = PROJECT_COLORS[project.name] ?? DEFAULT_COLOR;
          return (
            <Card key={project.name} className="py-3">
              <CardHeader className="gap-1 pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${colors.dot}`} />
                    <CardTitle className={`text-sm capitalize ${colors.text}`}>
                      {project.name}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {project.hitCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {project.narrative && (
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {project.narrative}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  {project.topBehaviors.map((behavior) => (
                    <span
                      key={behavior}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${colors.bg} ${colors.text}`}
                    >
                      {behavior}
                    </span>
                  ))}
                </div>

                {project.topHit && (
                  <div className="bg-muted/40 mt-2 rounded-md px-2.5 py-1.5 text-[11px]">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <RoleBadge role={project.topHit.role} />
                      <span className="text-muted-foreground">
                        {project.topHit.issue}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {truncate(project.topHit.chunkText)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="py-3">
            <CardHeader className="gap-1 pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="mt-1 h-8 w-full" />
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 2 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-16 rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
