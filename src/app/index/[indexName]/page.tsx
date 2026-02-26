"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { FacetPanel, applyFacetFilters, type FacetSelection } from "@/components/facet-panel";
import { SearchResults, type SearchHit } from "@/components/search-results";
import {
  BehaviorCard,
  BehaviorCardSkeleton,
  type BehaviorData,
} from "@/components/behavior-card";
import {
  DashboardStats,
  DashboardStatsSkeleton,
} from "@/components/dashboard-stats";
import {
  CrossCuttingInsights,
  CrossCuttingInsightsSkeleton,
} from "@/components/cross-cutting-insights";
import {
  ProjectBreakdown,
  ProjectBreakdownSkeleton,
  type ProjectData,
} from "@/components/project-breakdown";
import {
  RoleDistribution,
  RoleDistributionSkeleton,
} from "@/components/role-distribution";
import { ResultsSummary } from "@/components/results-summary";
import { SummaryJobTracker } from "@/components/summary-job-tracker";
import { TagBar } from "@/components/tag-bar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTagStore } from "@/hooks/use-tag-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, BarChart3, Brain, Sparkles, Loader2, Upload, Database, Trash2 } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  totalChunks: number;
  expanded: boolean;
  crossCuttingInsights: string[];
  behaviors: BehaviorData[];
  projects: ProjectData[];
  roleDistribution: Record<string, number>;
}

interface PineconeIndex {
  name: string;
  metric: string;
  dimension: number;
  status: { ready: boolean };
  host: string;
}

export default function IndexDashboard() {
  const params = useParams<{ indexName: string }>();
  const router = useRouter();
  const activeIndex = decodeURIComponent(params.indexName);

  const [query, setQuery] = useState("");
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({});
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [similarTo, setSimilarTo] = useState<SearchHit | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [queryRewrites, setQueryRewrites] = useState<string[]>([]);

  const [indexes, setIndexes] = useState<PineconeIndex[]>([]);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);

  const tagStore = useTagStore();

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const syncFromHitsRef = useRef(tagStore.syncFromHits);
  syncFromHitsRef.current = tagStore.syncFromHits;

  useEffect(() => {
    fetch("/api/pinecone")
      .then((res) => res.json())
      .then((data) => {
        if (data.indexes) setIndexes(data.indexes);
      })
      .catch((err) => console.error("Failed to load indexes:", err));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleDeleteIndex = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/pinecone", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexName: activeIndex }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const remaining = indexes.filter((idx) => idx.name !== activeIndex);
      setIndexes(remaining);
      setDeleteDialogOpen(false);

      if (remaining.length > 0) {
        router.push(`/index/${encodeURIComponent(remaining[0].name)}`);
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }, [activeIndex, indexes, router]);

  const loadDashboard = useCallback((indexName: string, bust = false) => {
    setDashboardLoading(true);
    const params = new URLSearchParams({ indexName });
    if (bust) params.set("bust", "1");
    fetch(`/api/dashboard?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setDashboard(data);
        else setDashboard(null);
      })
      .catch((err) => {
        console.error("Dashboard failed:", err);
        setDashboard(null);
      })
      .finally(() => setDashboardLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard(activeIndex);
    tagStore.setIndexName(activeIndex);
    tagStore.loadFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const handleIndexChange = useCallback((indexName: string) => {
    router.push(`/index/${encodeURIComponent(indexName)}`);
  }, [router]);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    setFacetSelection({});
    setQueryRewrites([]);
    try {
      const body: Record<string, unknown> = {
        query: searchQuery.trim(),
        topK: 15,
        indexName: activeIndexRef.current,
      };

      const res = await fetch("/api/enhanced-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHits(data.hits);
      setSearchedQuery(searchQuery.trim());
      setQueryRewrites(data.rewrites ?? []);
      syncFromHitsRef.current(data.hits);
    } catch (err) {
      console.error("Search failed:", err);
      setHits([]);
      setSearchedQuery("");
      setQueryRewrites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    setSimilarTo(null);
    doSearch(query);
  }, [query, doSearch]);

  const handleSuggestedQuery = useCallback(
    (sq: string) => {
      setSimilarTo(null);
      setQuery(sq);
      doSearch(sq);
    },
    [doSearch]
  );

  const handleFindSimilar = useCallback(
    (hit: SearchHit) => {
      setSimilarTo(hit);
      setQuery(hit.chunkText.slice(0, 200));
      doSearch(hit.chunkText);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [doSearch]
  );

  const handleBehaviorClick = useCallback(
    (behavior: BehaviorData) => {
      setSimilarTo(null);
      setQuery(behavior.query);
      setSearchedQuery(behavior.label);
      setSearched(true);
      setHits(
        behavior.hits.map((h) => ({
          ...h,
          tags: [],
        }))
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    []
  );

  const handleProjectClick = useCallback(
    (projectName: string) => {
      const broadQuery = "debugging testing code changes error handling";
      setSimilarTo(null);
      setFacetSelection({ project: new Set([projectName]) });
      setQuery(broadQuery);
      doSearch(broadQuery);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [doSearch]
  );

  const handleExpandPatterns = useCallback(async () => {
    setExpanding(true);
    try {
      const params = new URLSearchParams({
        bust: "1",
        expand: "1",
        indexName: activeIndexRef.current,
      });
      const res = await fetch(`/api/dashboard?${params}`);
      const data = await res.json();
      if (!data.error) setDashboard(data);
    } catch (err) {
      console.error("Expansion failed:", err);
    } finally {
      setExpanding(false);
    }
  }, []);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleApplyTag = useCallback(
    (tag: string) => {
      tagStore.assignTag(Array.from(selectedIds), tag);
      setSelectedIds(new Set());
    },
    [selectedIds, tagStore.assignTag]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const behaviorHits = useMemo(() => {
    if (!dashboard?.behaviors) return [];
    const seen = new Set<string>();
    const all: SearchHit[] = [];
    for (const behavior of dashboard.behaviors) {
      for (const hit of behavior.hits) {
        if (!seen.has(hit.id)) {
          seen.add(hit.id);
          all.push({ ...hit, tags: [] });
        }
      }
    }
    return all;
  }, [dashboard?.behaviors]);

  const facetHits = searched ? hits : behaviorHits;

  const enrichedFacetHits = useMemo(() => {
    return facetHits.map((hit) => {
      const storeTags = tagStore.getTagsForHit(hit.id);
      if (storeTags.length === 0 && hit.tags.length === 0) return hit;
      const merged = [...new Set([...hit.tags, ...storeTags])];
      return { ...hit, tags: merged };
    });
  }, [facetHits, tagStore.getTagsForHit]);

  const enrichedHits = useMemo(() => {
    return hits.map((hit) => {
      const storeTags = tagStore.getTagsForHit(hit.id);
      if (storeTags.length === 0 && hit.tags.length === 0) return hit;
      const merged = [...new Set([...hit.tags, ...storeTags])];
      return { ...hit, tags: merged };
    });
  }, [hits, tagStore.getTagsForHit]);

  const displayHits = useMemo(
    () => applyFacetFilters(enrichedHits, facetSelection),
    [enrichedHits, facetSelection]
  );
  const showResults = searched;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Trace Explorer</h1>
          <p className="text-muted-foreground text-sm">
            Explore and search your Pinecone indexes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeIndex} onValueChange={handleIndexChange}>
            <SelectTrigger className="w-[220px]">
              <Database className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select index" />
            </SelectTrigger>
            <SelectContent>
              {indexes.map((idx) => (
                <SelectItem key={idx.name} value={idx.name}>
                  {idx.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {shiftHeld && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Index
            </Button>
          )}
          <Link href="/compare">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Compare
            </Button>
          </Link>
          <Link href="/upload">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </Link>
        </div>
      </header>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Index</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{activeIndex}</span>?
              This action is permanent and cannot be undone. All data in this index
              will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteIndex}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          onSuggestedQuery={handleSuggestedQuery}
          loading={loading}
          showSuggestions={!showResults}
        />
        <FacetPanel
          hits={enrichedFacetHits}
          selection={facetSelection}
          onSelectionChange={setFacetSelection}
          {...(activeIndex !== "agent-traces-semantic" && {
            hiddenFacets: ["project"],
          })}
        />
      </div>

      {showResults && (
        <button
          onClick={() => {
            setSimilarTo(null);
            setQuery("");
            setHits([]);
            setSearched(false);
            setSearchedQuery("");
            setQueryRewrites([]);
          }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Dashboard
        </button>
      )}

      {queryRewrites.length > 0 && searched && !loading && (
        <p className="text-muted-foreground text-xs">
          Also searched for:{" "}
          {queryRewrites.map((rw, i) => (
            <span key={i}>
              {i > 0 && " · "}
              <span className="italic">&ldquo;{rw}&rdquo;</span>
            </span>
          ))}
        </p>
      )}

      {similarTo && (
        <div className="bg-muted/50 flex items-start gap-3 rounded-lg border px-4 py-3">
          <div className="flex-1">
            <p className="text-xs font-medium">Finding chunks similar to:</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed line-clamp-2">
              {similarTo.chunkText}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              from {similarTo.project}/{similarTo.issue} &middot; turn{" "}
              {similarTo.turnIndex}
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setSimilarTo(null);
              setQuery("");
              setHits([]);
              setSearched(false);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {showResults && !loading && displayHits.length === 0 && (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No results found. Try a different query or adjust filters.
        </div>
      )}

      {showResults && !loading && displayHits.length > 0 && (
        <ResultsSummary query={searchedQuery} hits={displayHits} />
      )}

      <SearchResults
        hits={displayHits}
        loading={loading}
        onFindSimilar={handleFindSimilar}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        getTagsForHit={tagStore.getTagsForHit}
        onRemoveTag={tagStore.unassignTag}
        indexName={activeIndex}
      />

      <TagBar
        selectedCount={selectedIds.size}
        existingTags={tagStore.tags}
        onApplyTag={handleApplyTag}
        onClearSelection={handleClearSelection}
      />

      {!showResults && (
        <div className="flex flex-col gap-8">
          {dashboardLoading ? (
            <CrossCuttingInsightsSkeleton />
          ) : dashboard?.crossCuttingInsights ? (
            <CrossCuttingInsights insights={dashboard.crossCuttingInsights} />
          ) : null}

          {dashboardLoading ? (
            <DashboardStatsSkeleton />
          ) : dashboard ? (
            <DashboardStats
              totalChunks={dashboard.totalChunks}
              projectCount={dashboard.projects.length > 0 ? dashboard.projects.length : undefined}
              behaviorCount={dashboard.behaviors.length}
            />
          ) : null}

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-sky-500/10 flex size-7 items-center justify-center rounded-lg">
                  <Brain className="size-4 text-sky-400" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Agent Behavior Patterns
                </h2>
                {dashboard?.expanded && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    Expanded
                  </span>
                )}
              </div>
              {dashboard && !dashboard.expanded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExpandPatterns}
                  disabled={expanding}
                  className="gap-1.5 text-xs"
                >
                  {expanding ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Expanding...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Discover more
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboardLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <BehaviorCardSkeleton key={i} />
                  ))
                : dashboard?.behaviors.map((behavior) => (
                    <BehaviorCard
                      key={behavior.id}
                      behavior={behavior}
                      onClick={handleBehaviorClick}
                    />
                  ))}
            </div>
          </div>

          {activeIndex === "agent-traces-semantic" && (
            <>
              <Separator />

              {dashboardLoading ? (
                <ProjectBreakdownSkeleton />
              ) : dashboard?.projects ? (
                <ProjectBreakdown projects={dashboard.projects} onProjectClick={handleProjectClick} />
              ) : null}
            </>
          )}

          <Separator />

          {dashboardLoading ? (
            <RoleDistributionSkeleton />
          ) : dashboard?.roleDistribution ? (
            <RoleDistribution distribution={dashboard.roleDistribution} />
          ) : null}
        </div>
      )}

      <SummaryJobTracker />
    </div>
  );
}
