"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RoleBadge } from "@/components/role-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchHit {
  id: string;
  score: number;
  chunkText: string;
  role: string;
  traceId: string;
  turnIndex: number;
  chunkIndex: number;
  project: string;
  issue: string;
  tags: string[];
}

interface ContextTurn {
  turnIndex: number;
  role: string;
  text: string;
}

function formatScore(score: number) {
  return (score * 100).toFixed(1) + "%";
}

function truncate(text: string, maxLen = 280) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

function ContextThread({
  turns,
  highlightTurnIndex,
}: {
  turns: ContextTurn[];
  highlightTurnIndex: number;
}) {
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {turns.map((turn) => {
        const isHighlighted = turn.turnIndex === highlightTurnIndex;
        return (
          <div
            key={turn.turnIndex}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              isHighlighted
                ? "bg-primary/5 border-primary/30"
                : "bg-muted/30 border-transparent"
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <RoleBadge role={turn.role} />
              <span className="text-muted-foreground text-[11px] tabular-nums">
                Turn {turn.turnIndex}
              </span>
              {isHighlighted && (
                <span className="text-primary text-[11px] font-medium">
                  matched
                </span>
              )}
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {truncate(turn.text, 500)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ResultCard({
  hit,
  onFindSimilar,
  selected,
  onSelect,
  selectionActive,
  hitTags,
  onRemoveTag,
}: {
  hit: SearchHit;
  onFindSimilar?: (hit: SearchHit) => void;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  selectionActive: boolean;
  hitTags: string[];
  onRemoveTag?: (hitId: string, tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [contextTurns, setContextTurns] = useState<ContextTurn[] | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (expanded) {
      setExpanded(false);
      return;
    }

    if (contextTurns) {
      setExpanded(true);
      return;
    }

    setLoadingContext(true);
    try {
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId: hit.traceId,
          turnIndex: hit.turnIndex,
          radius: 2,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setContextTurns(data.turns);
      setExpanded(true);
    } catch (err) {
      console.error("Failed to load context:", err);
    } finally {
      setLoadingContext(false);
    }
  };

  const handleCardClick = () => {
    // Ignore click if user was selecting text
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;

    if (selectionActive) {
      onSelect(hit.id, !selected);
    } else {
      onFindSimilar?.(hit);
    }
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer py-4 transition-colors hover:border-ring/50",
        selected && "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20"
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) =>
              onSelect(hit.id, checked === true)
            }
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "transition-opacity",
              !selectionActive && "opacity-0 group-hover:opacity-100"
            )}
          />
          <RoleBadge role={hit.role} />
          <CardTitle className="text-sm">
            {hit.project}/{hit.issue}
          </CardTitle>
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {formatScore(hit.score)} match
          </span>
        </div>
        <CardDescription className="text-xs ml-8">
          Turn {hit.turnIndex} &middot; Chunk {hit.chunkIndex}
          {hitTags.length > 0 && (
            <span className="inline-flex items-center gap-1 ml-2">
              {hitTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 gap-0.5"
                >
                  {tag}
                  {onRemoveTag && (
                    <button
                      className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag(hit.id, tag);
                      }}
                    >
                      <X className="size-2" />
                    </button>
                  )}
                </Badge>
              ))}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="ml-8">
        {!expanded && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {truncate(hit.chunkText)}
          </p>
        )}

        {expanded && contextTurns && (
          <ContextThread
            turns={contextTurns}
            highlightTurnIndex={hit.turnIndex}
          />
        )}

        {loadingContext && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
            <span className="text-muted-foreground text-xs">
              Loading thread context...
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground gap-1"
            onClick={handleExpand}
          >
            {loadingContext ? (
              <Loader2 className="size-3 animate-spin" />
            ) : expanded ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            {expanded ? "Collapse" : "Expand thread"}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onFindSimilar?.(hit);
            }}
          >
            <Search className="size-3" />
            Find similar
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground gap-1"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href={`/trace/${encodeURIComponent(hit.traceId)}?turn=${hit.turnIndex}`}
            >
              View trace <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchResults({
  hits,
  loading,
  onFindSimilar,
  selectedIds,
  onSelect,
  getTagsForHit,
  onRemoveTag,
}: {
  hits: SearchHit[];
  loading?: boolean;
  onFindSimilar?: (hit: SearchHit) => void;
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  getTagsForHit: (id: string) => string[];
  onRemoveTag?: (hitId: string, tag: string) => void;
}) {
  const selectionActive = selectedIds.size > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="py-4">
            <CardHeader className="pb-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (hits.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {hits.map((hit) => (
        <ResultCard
          key={hit.id}
          hit={hit}
          onFindSimilar={onFindSimilar}
          selected={selectedIds.has(hit.id)}
          onSelect={onSelect}
          selectionActive={selectionActive}
          hitTags={getTagsForHit(hit.id)}
          onRemoveTag={onRemoveTag}
        />
      ))}
    </div>
  );
}
