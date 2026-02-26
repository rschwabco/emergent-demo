"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

export interface TagStore {
  tags: string[];
  assignments: Record<string, string[]>;
  assignTag: (hitIds: string[], tag: string) => void;
  unassignTag: (hitId: string, tag: string) => void;
  removeTag: (name: string) => void;
  getTagsForHit: (hitId: string) => string[];
  getHitIdsForTag: (tag: string) => Set<string>;
  syncFromHits: (hits: Array<{ id: string; tags: string[] }>) => void;
  loadFromServer: () => Promise<void>;
  setIndexName: (name: string) => void;
}

const LS_TAGS_KEY = "trace-explorer:tags";
const LS_ASSIGNMENTS_KEY = "trace-explorer:tag-assignments";

function readLocalTags(): string[] {
  try {
    const raw = localStorage.getItem(LS_TAGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readLocalAssignments(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LS_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalTags(tags: string[]) {
  try {
    localStorage.setItem(LS_TAGS_KEY, JSON.stringify(tags));
  } catch { /* quota exceeded, ignore */ }
}

function writeLocalAssignments(assignments: Record<string, string[]>) {
  try {
    localStorage.setItem(LS_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch { /* quota exceeded, ignore */ }
}

function persistToPinecone(updates: Array<{ id: string; tags: string[] }>, indexName?: string) {
  const body: Record<string, unknown> = { updates };
  if (indexName) body.indexName = indexName;
  fetch("/api/tags", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => console.error("Failed to persist tags to Pinecone:", err));
}

export function useTagStore(): TagStore {
  const [tags, setTags] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const assignmentsRef = useRef(assignments);
  assignmentsRef.current = assignments;
  const initializedRef = useRef(false);
  const indexNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const savedTags = readLocalTags();
    const savedAssignments = readLocalAssignments();
    if (savedTags.length > 0) setTags(savedTags);
    if (Object.keys(savedAssignments).length > 0) {
      setAssignments(savedAssignments);
      assignmentsRef.current = savedAssignments;
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    writeLocalTags(tags);
  }, [tags]);

  useEffect(() => {
    if (!initializedRef.current) return;
    writeLocalAssignments(assignments);
  }, [assignments]);

  const setIndexName = useCallback((name: string) => {
    indexNameRef.current = name;
  }, []);

  const loadFromServer = useCallback(async () => {
    try {
      const params = indexNameRef.current ? `?indexName=${encodeURIComponent(indexNameRef.current)}` : "";
      const res = await fetch(`/api/tags${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const serverTags: string[] = data.tags ?? [];
      if (serverTags.length > 0) {
        setTags((prev) => {
          const merged = new Set([...prev, ...serverTags]);
          return [...merged].sort();
        });
      }
    } catch (err) {
      console.error("Failed to load tags from server:", err);
    }
  }, []);

  const syncFromHits = useCallback(
    (hits: Array<{ id: string; tags: string[] }>) => {
      const current = assignmentsRef.current;
      let changed = false;
      const nextAssignments: Record<string, string[]> = { ...current };

      for (const hit of hits) {
        const hitTags = hit.tags ?? [];
        if (hitTags.length > 0) {
          const prev = current[hit.id];
          if (!prev || prev.length !== hitTags.length || prev.some((t, i) => t !== hitTags[i])) {
            nextAssignments[hit.id] = hitTags;
            changed = true;
          }
        }
      }

      if (changed) {
        setAssignments(nextAssignments);
      }

      setTags((prev) => {
        const allTags = new Set<string>(prev);
        let added = false;
        for (const hit of hits) {
          for (const t of hit.tags ?? []) {
            if (!allTags.has(t)) {
              allTags.add(t);
              added = true;
            }
          }
        }
        return added ? [...allTags].sort() : prev;
      });
    },
    []
  );

  const assignTag = useCallback(
    (hitIds: string[], tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;

      setTags((prev) => {
        if (prev.includes(normalized)) return prev;
        return [...prev, normalized].sort();
      });

      setAssignments((prev) => {
        const next = { ...prev };
        const updates: Array<{ id: string; tags: string[] }> = [];

        for (const id of hitIds) {
          const existing = next[id] || [];
          if (!existing.includes(normalized)) {
            next[id] = [...existing, normalized];
          } else {
            next[id] = existing;
          }
          updates.push({ id, tags: next[id] });
        }

        persistToPinecone(updates, indexNameRef.current);
        return next;
      });
    },
    []
  );

  const unassignTag = useCallback((hitId: string, tag: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (next[hitId]) {
        next[hitId] = next[hitId].filter((t) => t !== tag);
        if (next[hitId].length === 0) delete next[hitId];
      }
      persistToPinecone([{ id: hitId, tags: next[hitId] || [] }], indexNameRef.current);
      return next;
    });
  }, []);

  const removeTag = useCallback((name: string) => {
    setTags((prev) => prev.filter((t) => t !== name));
    setAssignments((prev) => {
      const next = { ...prev };
      const updates: Array<{ id: string; tags: string[] }> = [];

      for (const hitId of Object.keys(next)) {
        if (next[hitId].includes(name)) {
          next[hitId] = next[hitId].filter((t) => t !== name);
          if (next[hitId].length === 0) {
            delete next[hitId];
            updates.push({ id: hitId, tags: [] });
          } else {
            updates.push({ id: hitId, tags: next[hitId] });
          }
        }
      }

      if (updates.length > 0) persistToPinecone(updates, indexNameRef.current);
      return next;
    });
  }, []);

  const getTagsForHit = useCallback(
    (hitId: string) => assignments[hitId] || [],
    [assignments]
  );

  const getHitIdsForTag = useCallback(
    (tag: string) => {
      const ids = new Set<string>();
      for (const [hitId, hitTags] of Object.entries(assignments)) {
        if (hitTags.includes(tag)) ids.add(hitId);
      }
      return ids;
    },
    [assignments]
  );

  return useMemo(
    () => ({
      tags,
      assignments,
      assignTag,
      unassignTag,
      removeTag,
      getTagsForHit,
      getHitIdsForTag,
      syncFromHits,
      loadFromServer,
      setIndexName,
    }),
    [tags, assignments, assignTag, unassignTag, removeTag, getTagsForHit, getHitIdsForTag, syncFromHits, loadFromServer, setIndexName]
  );
}
