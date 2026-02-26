"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { SearchBar } from "@/components/search-bar";
import { FilterPanel } from "@/components/filter-panel";
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
import { TagBar, TagFilter } from "@/components/tag-bar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTagStore } from "@/hooks/use-tag-store";
import { ArrowLeft, Brain } from "lucide-react";

interface DashboardData {
  totalChunks: number;
  crossCuttingInsights: string[];
  behaviors: BehaviorData[];
  projects: ProjectData[];
  roleDistribution: Record<string, number>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [project, setProject] = useState("all");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [similarTo, setSimilarTo] = useState<SearchHit | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const tagStore = useTagStore();

  const roleRef = useRef(role);
  roleRef.current = role;
  const projectRef = useRef(project);
  projectRef.current = project;
  const syncFromHitsRef = useRef(tagStore.syncFromHits);
  syncFromHitsRef.current = tagStore.syncFromHits;

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setDashboard(data);
      })
      .catch((err) => console.error("Dashboard failed:", err))
      .finally(() => setDashboardLoading(false));

    tagStore.loadFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const filters: Record<string, string> = {};
      if (roleRef.current !== "all") filters.role = roleRef.current;
      if (projectRef.current !== "all") filters.project = projectRef.current;

      const body: Record<string, unknown> = {
        query: searchQuery.trim(),
        topK: 15,
      };
      if (Object.keys(filters).length > 0) body.filters = filters;

      const res = await fetch("/api/hybrid-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHits(data.hits);
      syncFromHitsRef.current(data.hits);
    } catch (err) {
      console.error("Search failed:", err);
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    setSimilarTo(null);
    doSearch(query);
  }, [query, doSearch]);

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
      const searchText = behavior.topHits[0]?.chunkText ?? behavior.query;
      doSearch(searchText);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [doSearch]
  );

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
    [selectedIds, tagStore]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of tagStore.tags) {
      counts[tag] = tagStore.getHitIdsForTag(tag).size;
    }
    return counts;
  }, [tagStore]);

  const [tagFilterHits, setTagFilterHits] = useState<SearchHit[] | null>(null);
  const [tagFilterLoading, setTagFilterLoading] = useState(false);

  const handleTagFilter = useCallback(
    async (tag: string | null) => {
      setActiveTagFilter(tag);
      setSelectedIds(new Set());

      if (!tag) {
        setTagFilterHits(null);
        return;
      }

      setTagFilterLoading(true);
      try {
        const res = await fetch("/api/tags/filter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTagFilterHits(data.hits);
        syncFromHitsRef.current(data.hits);
      } catch (err) {
        console.error("Tag filter failed:", err);
        setTagFilterHits([]);
      } finally {
        setTagFilterLoading(false);
      }
    },
    []
  );

  const displayHits = useMemo(() => {
    const source = activeTagFilter && tagFilterHits !== null ? tagFilterHits : hits;
    return source.filter((h) => {
      if (role !== "all" && h.role !== role) return false;
      if (project !== "all" && h.project !== project) return false;
      return true;
    });
  }, [hits, tagFilterHits, activeTagFilter, role, project]);
  const isLoading = activeTagFilter ? tagFilterLoading : loading;
  const showResults = searched || activeTagFilter;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Trace Explorer</h1>
        <p className="text-muted-foreground text-sm">
          AI coding agent behavior insights from 141K SWE-bench trace chunks
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          loading={loading}
        />
        <FilterPanel
          role={role}
          project={project}
          onRoleChange={setRole}
          onProjectChange={setProject}
        />
        <TagFilter
          tags={tagStore.tags}
          activeTag={activeTagFilter}
          onTagFilter={handleTagFilter}
          tagCounts={tagCounts}
          onDeleteTag={tagStore.removeTag}
        />
      </div>

      {showResults && (
        <button
          onClick={() => {
            setSimilarTo(null);
            setQuery("");
            setHits([]);
            setSearched(false);
            setActiveTagFilter(null);
            setTagFilterHits(null);
          }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Dashboard
        </button>
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

      {showResults && !isLoading && displayHits.length === 0 && (
        <div className="text-muted-foreground py-12 text-center text-sm">
          {activeTagFilter
            ? `No records tagged "${activeTagFilter}".`
            : "No results found. Try a different query or adjust filters."}
        </div>
      )}

      <SearchResults
        hits={displayHits}
        loading={isLoading}
        onFindSimilar={handleFindSimilar}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        getTagsForHit={tagStore.getTagsForHit}
        onRemoveTag={tagStore.unassignTag}
      />

      <TagBar
        selectedCount={selectedIds.size}
        existingTags={tagStore.tags}
        onApplyTag={handleApplyTag}
        onClearSelection={handleClearSelection}
      />

      {!showResults && (
        <div className="flex flex-col gap-8">
          {/* Cross-cutting insights */}
          {dashboardLoading ? (
            <CrossCuttingInsightsSkeleton />
          ) : dashboard?.crossCuttingInsights ? (
            <CrossCuttingInsights insights={dashboard.crossCuttingInsights} />
          ) : null}

          {/* Stats strip */}
          {dashboardLoading ? (
            <DashboardStatsSkeleton />
          ) : dashboard ? (
            <DashboardStats
              totalChunks={dashboard.totalChunks}
              projectCount={dashboard.projects.length}
              behaviorCount={dashboard.behaviors.length}
            />
          ) : null}

          <Separator />

          {/* Behavior pattern cards */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-sky-500/10 flex size-7 items-center justify-center rounded-lg">
                <Brain className="size-4 text-sky-400" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                Agent Behavior Patterns
              </h2>
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

          <Separator />

          {/* Project breakdown */}
          {dashboardLoading ? (
            <ProjectBreakdownSkeleton />
          ) : dashboard?.projects ? (
            <ProjectBreakdown projects={dashboard.projects} />
          ) : null}

          <Separator />

          {/* Role distribution */}
          {dashboardLoading ? (
            <RoleDistributionSkeleton />
          ) : dashboard?.roleDistribution ? (
            <RoleDistribution distribution={dashboard.roleDistribution} />
          ) : null}
        </div>
      )}
    </div>
  );
}
