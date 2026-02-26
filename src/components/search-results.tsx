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
  Tag,
  Brain,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

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
  sources?: string[];
  semanticRank?: number | null;
  keywordRank?: number | null;
}

interface ContextTurn {
  turnIndex: number;
  role: string;
  text: string;
}

function truncate(text: string, maxLen = 280) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

function SourceBadges({ hit }: { hit: SearchHit }) {
  const sources = hit.sources ?? [];
  if (sources.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {sources.includes("semantic") && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          title={
            hit.semanticRank != null
              ? `Semantic rank #${hit.semanticRank}`
              : "Found via semantic search"
          }
        >
          <Brain className="size-2.5" />
          semantic
          {hit.semanticRank != null && (
            <span className="tabular-nums">#{hit.semanticRank}</span>
          )}
        </span>
      )}
      {sources.includes("keyword") && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          title={
            hit.keywordRank != null
              ? `Keyword rank #${hit.keywordRank}`
              : "Found via keyword search"
          }
        >
          <Type className="size-2.5" />
          keyword
          {hit.keywordRank != null && (
            <span className="tabular-nums">#{hit.keywordRank}</span>
          )}
        </span>
      )}
    </span>
  );
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
  rank,
  onFindSimilar,
  selected,
  onSelect,
  selectionActive,
  hitTags,
  onRemoveTag,
}: {
  hit: SearchHit;
  rank: number;
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
          <span className="ml-auto flex items-center gap-1.5">
            <SourceBadges hit={hit} />
            <span className="text-muted-foreground text-[11px] tabular-nums">
              #{rank}
            </span>
          </span>
        </div>
        <CardDescription className="text-xs ml-8">
          Turn {hit.turnIndex} &middot; Chunk {hit.chunkIndex}
        </CardDescription>
        {hitTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 ml-8 mt-1">
            {hitTags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                  getTagColor(tag)
                )}
              >
                <Tag className="size-3" />
                {tag}
                {onRemoveTag && (
                  <button
                    className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(hit.id, tag);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
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
      {hits.map((hit, i) => (
        <ResultCard
          key={hit.id}
          hit={hit}
          rank={i + 1}
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
