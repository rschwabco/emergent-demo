"use client";

import { useEffect, useRef } from "react";
import { RoleBadge } from "@/components/role-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface Turn {
  turnIndex: number;
  role: string;
  text: string;
}

function TurnBubble({
  turn,
  highlighted,
}: {
  turn: Turn;
  highlighted: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const isUser = turn.role === "user";
  const isTool = turn.role === "tool";
  const isSystem = turn.role === "system";

  return (
    <div
      ref={ref}
      id={`turn-${turn.turnIndex}`}
      className={cn(
        "flex gap-3",
        isUser || isSystem ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3",
          isSystem && "bg-purple-500/10 border border-purple-500/20 italic text-xs",
          isUser && "bg-blue-500/10 border border-blue-500/20",
          turn.role === "assistant" &&
            "bg-emerald-500/10 border border-emerald-500/20",
          isTool && "bg-amber-500/10 border border-amber-500/20 font-mono text-xs",
          highlighted && "ring-ring ring-2 ring-offset-2 ring-offset-background"
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <RoleBadge role={turn.role} />
          <span className="text-muted-foreground text-[11px] tabular-nums">
            #{turn.turnIndex}
          </span>
        </div>
        <div
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap break-words",
            isTool && "text-xs"
          )}
        >
          {turn.text}
        </div>
      </div>
    </div>
  );
}

export function TraceConversation({
  turns,
  highlightTurn,
  loading,
}: {
  turns: Turn[];
  highlightTurn?: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn("flex gap-3", i % 2 === 0 ? "" : "justify-end")}
          >
            <div className="max-w-[80%] space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={cn("h-20", i % 2 === 0 ? "w-96" : "w-80")} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <TurnBubble
          key={turn.turnIndex}
          turn={turn}
          highlighted={turn.turnIndex === highlightTurn}
        />
      ))}
    </div>
  );
}
