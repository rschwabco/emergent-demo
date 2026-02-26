"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  assistant: "bg-violet-500",
  tool: "bg-sky-500",
  user: "bg-emerald-500",
  system: "bg-amber-500",
};

const ROLE_TEXT_COLORS: Record<string, string> = {
  assistant: "text-violet-400",
  tool: "text-sky-400",
  user: "text-emerald-400",
  system: "text-amber-400",
};

const ROLE_BG_COLORS: Record<string, string> = {
  assistant: "bg-violet-500/10",
  tool: "bg-sky-500/10",
  user: "bg-emerald-500/10",
  system: "bg-amber-500/10",
};

interface RoleDistributionProps {
  distribution: Record<string, number>;
}

export function RoleDistribution({ distribution }: RoleDistributionProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const roles = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => ({
      role,
      count,
      pct: Math.round((count / total) * 100),
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-violet-500/10 flex size-7 items-center justify-center rounded-lg">
          <Users className="size-4 text-violet-400" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          Role Distribution
        </h2>
      </div>
      <Card className="px-5 py-4">
        <div className="flex h-4 overflow-hidden rounded-full">
          {roles.map(({ role, pct }) => (
            <div
              key={role}
              className={`${ROLE_COLORS[role] ?? "bg-muted"} transition-all first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${pct}%` }}
              title={`${role}: ${pct}%`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {roles.map(({ role, count, pct }) => (
            <div key={role} className="flex items-center gap-2">
              <span className={`flex size-6 items-center justify-center rounded-md ${ROLE_BG_COLORS[role] ?? "bg-muted"}`}>
                <span className={`size-2 rounded-full ${ROLE_COLORS[role] ?? "bg-muted"}`} />
              </span>
              <div className="flex flex-col">
                <span className={`text-xs font-semibold capitalize ${ROLE_TEXT_COLORS[role] ?? "text-muted-foreground"}`}>
                  {role}
                </span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {pct}% &middot; {count} chunks
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function RoleDistributionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Card className="px-5 py-4">
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="mt-3 flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-md" />
              <div className="flex flex-col gap-0.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-2.5 w-18" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
