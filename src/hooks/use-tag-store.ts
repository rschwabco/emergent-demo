"use client";

import { useCallback, useMemo } from "react";
import type { SearchHit } from "@/components/search-results";

export interface TagStore {
  /** All known tag names from current hits, sorted alphabetically */
  tags: string[];
  /** Assign a tag to hit IDs (calls the API and updates local hits) */
  assignTag: (hitIds: string[], tag: string) => void;
  /** Remove a tag from a hit (calls the API and updates local hits) */
  unassignTag: (hitId: string, tag: string) => void;
  /** Get tags for a hit from its data */
  getTagsForHit: (hitId: string) => string[];
  /** Get hit IDs that have a given tag */
  getHitIdsForTag: (tag: string) => Set<string>;
  /** Remove a tag from all hits */
  removeTag: (tag: string) => void;
}

async function apiTagAction(
  recordId: string,
  tag: string,
  action: "add" | "remove"
): Promise<string[] | null> {
  try {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, tag, action }),
    });
    const data = await res.json();
    if (data.error) {
      console.error(`Tag ${action} failed:`, data.error);
      return null;
    }
    return data.tags;
  } catch (err) {
    console.error(`Tag ${action} failed:`, err);
    return null;
  }
}

export function useTagStore(
  hits: SearchHit[],
  setHits: React.Dispatch<React.SetStateAction<SearchHit[]>>
): TagStore {
  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const hit of hits) {
      if (hit.tags) {
        for (const t of hit.tags) tagSet.add(t);
      }
    }
    return Array.from(tagSet).sort();
  }, [hits]);

  const assignTag = useCallback(
    (hitIds: string[], tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;

      // Optimistically update local state
      setHits((prev) =>
        prev.map((h) => {
          if (!hitIds.includes(h.id)) return h;
          if (h.tags?.includes(normalized)) return h;
          return { ...h, tags: [...(h.tags || []), normalized] };
        })
      );

      // Fire API calls (don't await — fire and forget with error rollback)
      for (const id of hitIds) {
        apiTagAction(id, normalized, "add").then((serverTags) => {
          if (serverTags === null) {
            // Rollback on failure
            setHits((prev) =>
              prev.map((h) =>
                h.id === id
                  ? { ...h, tags: (h.tags || []).filter((t) => t !== normalized) }
                  : h
              )
            );
          }
        });
      }
    },
    [setHits]
  );

  const unassignTag = useCallback(
    (hitId: string, tag: string) => {
      // Optimistically update
      setHits((prev) =>
        prev.map((h) =>
          h.id === hitId
            ? { ...h, tags: (h.tags || []).filter((t) => t !== tag) }
            : h
        )
      );

      apiTagAction(hitId, tag, "remove").then((serverTags) => {
        if (serverTags === null) {
          // Rollback
          setHits((prev) =>
            prev.map((h) =>
              h.id === hitId
                ? { ...h, tags: [...(h.tags || []), tag] }
                : h
            )
          );
        }
      });
    },
    [setHits]
  );

  const getTagsForHit = useCallback(
    (hitId: string) => {
      const hit = hits.find((h) => h.id === hitId);
      return hit?.tags || [];
    },
    [hits]
  );

  const getHitIdsForTag = useCallback(
    (tag: string) => {
      const ids = new Set<string>();
      for (const hit of hits) {
        if (hit.tags?.includes(tag)) ids.add(hit.id);
      }
      return ids;
    },
    [hits]
  );

  const removeTag = useCallback(
    (tag: string) => {
      // Find all hits that have this tag, remove from each
      const affectedIds = hits.filter((h) => h.tags?.includes(tag)).map((h) => h.id);

      // Optimistically update
      setHits((prev) =>
        prev.map((h) =>
          h.tags?.includes(tag)
            ? { ...h, tags: h.tags.filter((t) => t !== tag) }
            : h
        )
      );

      for (const id of affectedIds) {
        apiTagAction(id, tag, "remove");
      }
    },
    [hits, setHits]
  );

  return {
    tags,
    assignTag,
    unassignTag,
    getTagsForHit,
    getHitIdsForTag,
    removeTag,
  };
}
