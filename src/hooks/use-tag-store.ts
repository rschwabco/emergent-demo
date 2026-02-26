"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "trace-explorer-tags";

export interface TagStore {
  /** All known tag names, sorted alphabetically */
  tags: string[];
  /** Map from hit ID to the set of tags assigned to it */
  assignments: Record<string, string[]>;
  addTag: (name: string) => void;
  removeTag: (name: string) => void;
  assignTag: (hitIds: string[], tag: string) => void;
  unassignTag: (hitId: string, tag: string) => void;
  getTagsForHit: (hitId: string) => string[];
  getHitIdsForTag: (tag: string) => Set<string>;
}

interface StoredState {
  tags: string[];
  assignments: Record<string, string[]>;
}

function loadState(): StoredState {
  if (typeof window === "undefined") return { tags: [], assignments: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tags: [], assignments: {} };
    const parsed = JSON.parse(raw) as StoredState;
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      assignments:
        parsed.assignments && typeof parsed.assignments === "object"
          ? parsed.assignments
          : {},
    };
  } catch {
    return { tags: [], assignments: {} };
  }
}

function saveState(state: StoredState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useTagStore(): TagStore {
  const [tags, setTags] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      const state = loadState();
      setTags(state.tags);
      setAssignments(state.assignments);
      initialized.current = true;
    }
  }, []);

  const persist = useCallback(
    (nextTags: string[], nextAssignments: Record<string, string[]>) => {
      saveState({ tags: nextTags, assignments: nextAssignments });
    },
    []
  );

  const addTag = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return;
      setTags((prev) => {
        if (prev.includes(normalized)) return prev;
        const next = [...prev, normalized].sort();
        persist(next, assignments);
        return next;
      });
    },
    [assignments, persist]
  );

  const removeTag = useCallback(
    (name: string) => {
      setTags((prev) => {
        const next = prev.filter((t) => t !== name);
        const nextAssignments = { ...assignments };
        for (const hitId of Object.keys(nextAssignments)) {
          nextAssignments[hitId] = nextAssignments[hitId].filter(
            (t) => t !== name
          );
          if (nextAssignments[hitId].length === 0)
            delete nextAssignments[hitId];
        }
        setAssignments(nextAssignments);
        persist(next, nextAssignments);
        return next;
      });
    },
    [assignments, persist]
  );

  const assignTag = useCallback(
    (hitIds: string[], tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;

      setTags((prevTags) => {
        const nextTags = prevTags.includes(normalized)
          ? prevTags
          : [...prevTags, normalized].sort();

        setAssignments((prevAssign) => {
          const nextAssign = { ...prevAssign };
          for (const id of hitIds) {
            const existing = nextAssign[id] || [];
            if (!existing.includes(normalized)) {
              nextAssign[id] = [...existing, normalized];
            }
          }
          persist(nextTags, nextAssign);
          return nextAssign;
        });

        return nextTags;
      });
    },
    [persist]
  );

  const unassignTag = useCallback(
    (hitId: string, tag: string) => {
      setAssignments((prev) => {
        const next = { ...prev };
        if (next[hitId]) {
          next[hitId] = next[hitId].filter((t) => t !== tag);
          if (next[hitId].length === 0) delete next[hitId];
        }
        persist(tags, next);
        return next;
      });
    },
    [tags, persist]
  );

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

  return {
    tags,
    assignments,
    addTag,
    removeTag,
    assignTag,
    unassignTag,
    getTagsForHit,
    getHitIdsForTag,
  };
}
