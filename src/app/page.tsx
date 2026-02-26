"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { SearchBar } from "@/components/search-bar";
import { SearchResults, type SearchHit } from "@/components/search-results";
import {
  TopicCard,
  TopicCardSkeleton,
  type TopicData,
} from "@/components/topic-card";
import { TagBar } from "@/components/tag-bar";
import {
  FacetPanel,
  applyFacetFilters,
  hasActiveFacets,
  type FacetSelection,
} from "@/components/facet-panel";
import { Button } from "@/components/ui/button";
import { useTagStore } from "@/hooks/use-tag-store";

export default function Home() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [similarTo, setSimilarTo] = useState<SearchHit | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({});

  const [topics, setTopics] = useState<TopicData[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const tagStore = useTagStore(hits, setHits);

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
      const [semanticRes, textRes] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery.trim(),
            topK: 15,
            rerank: true,
          }),
        }),
        fetch("/api/text-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery.trim(),
            topK: 15,
          }),
        }),
      ]);

      const [semanticData, textData] = await Promise.all([
        semanticRes.json(),
        textRes.json(),
      ]);

      const semanticHits: SearchHit[] = semanticData.error ? [] : (semanticData.hits ?? []);
      const textHits: SearchHit[] = textData.error ? [] : (textData.hits ?? []);

      // Merge and deduplicate: semantic results first, then text-only results
      const seen = new Set<string>();
      const merged: SearchHit[] = [];
      for (const hit of semanticHits) {
        seen.add(hit.id);
        merged.push(hit);
      }
      for (const hit of textHits) {
        if (!seen.has(hit.id)) {
          seen.add(hit.id);
          merged.push(hit);
        }
      }
      setHits(merged);
      setFacetSelection({});
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

  const handleTopicClick = useCallback(
    (topic: TopicData) => {
      setSimilarTo(null);
      setQuery(topic.query);
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

  // Collect all hits from explore topics for facet counts on the landing page
  const topicHits = useMemo(() => {
    const seen = new Set<string>();
    const all: SearchHit[] = [];
    for (const topic of topics) {
      for (const hit of topic.hits) {
        if (!seen.has(hit.id)) {
          seen.add(hit.id);
          all.push(hit);
        }
      }
    }
    return all;
  }, [topics]);

  const facetHits = searched ? hits : topicHits;

  const filteredHits = useMemo(() => {
    if (!hasActiveFacets(facetSelection)) return hits;
    return applyFacetFilters(hits, facetSelection);
  }, [hits, facetSelection]);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1
          className="text-3xl font-bold tracking-tight cursor-pointer"
          onClick={() => {
            setSimilarTo(null);
            setQuery("");
            setHits([]);
            setSearched(false);
            setFacetSelection({});
            setSelectedIds(new Set());
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Trace Explorer
        </h1>
        <a
          href="https://www.pinecone.io"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Powered by Pinecone"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 288"
            className="h-8 w-auto opacity-60 transition-opacity hover:opacity-100"
          >
            <path
              fill="currentColor"
              d="M108.634 254.436c9.08 0 16.44 7.361 16.44 16.442s-7.36 16.44-16.44 16.44s-16.442-7.36-16.442-16.44s7.361-16.442 16.442-16.442m91.216-29.998l16.247 4.814L203.2 272.78a8.47 8.47 0 0 1-8.7 6.046l-3.983-.273l-.098.08l-41.39-2.904l1.152-16.906l27.808 1.887l-18.205-26.262l13.926-9.656l18.229 26.295zm-176.837-30.09l16.903 1.197l-1.98 27.804L64.15 205.12l9.677 13.91l-26.248 18.248l26.792 7.895l-4.79 16.255l-43.732-12.885a8.47 8.47 0 0 1-6.058-8.726zM132.15 170.67l30.508 36.832l-13.75 11.389l-18.156-21.92l-5.886 33.702l-17.587-3.074l5.892-33.755l-24.442 14.412l-9.063-15.383l41.079-24.2a8.93 8.93 0 0 1 11.405 1.997m85.354-24.71l15.239-8.292l22.2 40.805a8.675 8.675 0 0 1-1.926 10.69l-3.141 2.714l-32.05 27.893l-11.386-13.09l21.548-18.747l-32.095-5.781l3.078-17.074l32.073 5.779zM37.782 103.298l11.48 13.008l-21.251 18.743l32.156 5.614l-2.98 17.091l-32.192-5.618l13.827 24.998l-15.18 8.398l-22.558-40.776a8.675 8.675 0 0 1 1.85-10.703zm108.694-13.42l30.404 36.734l-13.753 11.384l-18.152-21.93l-5.886 33.712l-17.587-3.074l5.872-33.624l-24.349 14.274l-9.027-15.403l37.4-21.929l.038-.142l.165.021l3.485-2.032a8.93 8.93 0 0 1 11.39 2.01m39.18-18.065l6.65-16.024l43.012 17.85a8.675 8.675 0 0 1 5.218 9.517l-.716 3.982l-7.345 41.78l-17.086-3.01l4.924-27.968l-28.537 15.772l-8.386-15.188l28.591-15.784zm-81.939-31.577l.74 17.334l-28.414 1.214l21.43 24.49l-13.056 11.424L62.95 70.173l-5.001 28l-17.078-3.054l8.184-45.759a8.674 8.674 0 0 1 8.17-7.139l4.02-.18l.09-.065zm58.121-36.965l30.267 36.965l-13.814 11.31l-17.964-21.943l-6.059 33.668l-17.57-3.162l6.068-33.743l-24.526 14.34l-9.007-15.415L150.428 1.22a8.93 8.93 0 0 1 11.41 2.052"
            />
          </svg>
        </a>
      </header>

      <div className="flex flex-col gap-3">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          loading={loading}
        />
        <FacetPanel
          hits={facetHits}
          selection={facetSelection}
          onSelectionChange={setFacetSelection}
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
          No results found. Try a different query or adjust filters.
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
