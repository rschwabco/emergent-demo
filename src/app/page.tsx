"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { SearchBar } from "@/components/search-bar";
import { FilterPanel } from "@/components/filter-panel";
import { SearchResults, type SearchHit } from "@/components/search-results";
import {
  TopicCard,
  TopicCardSkeleton,
  type TopicData,
} from "@/components/topic-card";
import { TagBar, TagFilter } from "@/components/tag-bar";
import { Button } from "@/components/ui/button";
import { useTagStore } from "@/hooks/use-tag-store";

export default function Home() {
  const [query, setQuery] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [role, setRole] = useState("all");
  const [project, setProject] = useState("all");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [similarTo, setSimilarTo] = useState<SearchHit | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const [topics, setTopics] = useState<TopicData[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const tagStore = useTagStore();

  const roleRef = useRef(role);
  roleRef.current = role;
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    fetch("/api/explore")
      .then((res) => res.json())
      .then((data) => {
        if (data.topics) setTopics(data.topics);
      })
      .catch((err) => console.error("Explore failed:", err))
      .finally(() => setTopicsLoading(false));
  }, []);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const body: Record<string, unknown> = {
        query: searchQuery.trim(),
        topK: 15,
        rerank: true,
      };
      const filters: Record<string, string> = {};
      if (roleRef.current !== "all") filters.role = roleRef.current;
      if (projectRef.current !== "all") filters.project = projectRef.current;
      if (Object.keys(filters).length > 0) body.filters = filters;

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHits(data.hits);
    } catch (err) {
      console.error("Search failed:", err);
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const doTextSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const body: Record<string, unknown> = {
        query: searchQuery.trim(),
        topK: 15,
      };
      const filters: Record<string, string> = {};
      if (roleRef.current !== "all") filters.role = roleRef.current;
      if (projectRef.current !== "all") filters.project = projectRef.current;
      if (Object.keys(filters).length > 0) body.filters = filters;

      const res = await fetch("/api/text-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHits(data.hits);
    } catch (err) {
      console.error("Text search failed:", err);
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    setSimilarTo(null);
    if (query.trim()) {
      doSearch(query);
    } else if (textQuery.trim()) {
      doTextSearch(textQuery);
    }
  }, [query, textQuery, doSearch, doTextSearch]);

  const handleFindSimilar = useCallback(
    (hit: SearchHit) => {
      setSimilarTo(hit);
      setQuery(hit.chunkText.slice(0, 200));
      setTextQuery("");
      doSearch(hit.chunkText);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [doSearch]
  );

  const handleTopicClick = useCallback(
    (topic: TopicData) => {
      setSimilarTo(null);
      setQuery(topic.query);
      setTextQuery("");
      doSearch(topic.query);
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

  const filteredHits = useMemo(() => {
    if (!activeTagFilter) return hits;
    const taggedIds = tagStore.getHitIdsForTag(activeTagFilter);
    return hits.filter((h) => taggedIds.has(h.id));
  }, [hits, activeTagFilter, tagStore]);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Trace Explorer</h1>
        <p className="text-muted-foreground text-sm">
          Semantically search 141K chunks of AI coding agent traces from
          SWE-bench. Find how agents debug, fix, and test real open-source
          issues.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          textQuery={textQuery}
          onTextQueryChange={setTextQuery}
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
          onTagFilter={setActiveTagFilter}
          tagCounts={tagCounts}
          onDeleteTag={tagStore.removeTag}
        />
      </div>

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
              setTextQuery("");
              setHits([]);
              setSearched(false);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {searched && !loading && filteredHits.length === 0 && (
        <div className="text-muted-foreground py-12 text-center text-sm">
          {activeTagFilter
            ? `No results with tag "${activeTagFilter}". Try clearing the tag filter.`
            : "No results found. Try a different query or adjust filters."}
        </div>
      )}

      <SearchResults
        hits={filteredHits}
        loading={loading}
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

      {!searched && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Explore Topics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {topicsLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TopicCardSkeleton key={i} />
                ))
              : topics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onClick={handleTopicClick}
                  />
                ))}
          </div>
        </div>
      )}
    </div>
  );
}
