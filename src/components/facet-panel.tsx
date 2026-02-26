"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/components/search-results";

/** Pinned facets always show, even with no results. */
const PINNED_FACETS: {
  key: string;
  label: string;
  type: "string" | "array";
  knownValues?: string[];
}[] = [
  {
    key: "tags",
    label: "Tags",
    type: "array",
  },
  {
    key: "role",
    label: "Role",
    type: "string",
    knownValues: ["system", "user", "assistant", "tool"],
  },
  {
    key: "project",
    label: "Project",
    type: "string",
    knownValues: [
      "django",
      "scikit-learn",
      "matplotlib",
      "pytest-dev",
      "sympy",
      "astropy",
      "sphinx-doc",
      "pallets",
    ],
  },
];

/** Dynamic facets only show when they have 2+ values in results. */
const DYNAMIC_FACETS: { key: keyof SearchHit; label: string }[] = [
  { key: "issue", label: "Issue" },
];

export type FacetSelection = Record<string, Set<string>>;

interface FacetPanelProps {
  hits: SearchHit[];
  selection: FacetSelection;
  onSelectionChange: (selection: FacetSelection) => void;
}

interface Facet {
  key: string;
  label: string;
  buckets: { value: string; count: number }[];
}

function buildFacets(hits: SearchHit[]): Facet[] {
  const facets: Facet[] = [];

  // Pinned facets: always show
  for (const { key, label, type, knownValues } of PINNED_FACETS) {
    const counts = new Map<string, number>();

    for (const hit of hits) {
      const raw = (hit as unknown as Record<string, unknown>)[key];
      if (type === "array" && Array.isArray(raw)) {
        for (const v of raw) {
          const val = String(v);
          if (val) counts.set(val, (counts.get(val) || 0) + 1);
        }
      } else if (type === "string") {
        const val = String(raw ?? "");
        if (val) counts.set(val, (counts.get(val) || 0) + 1);
      }
    }

    // For pinned facets with known values, always include those values
    if (knownValues) {
      for (const v of knownValues) {
        if (!counts.has(v)) counts.set(v, 0);
      }
    }

    const buckets = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    // Always show pinned facets (even if empty)
    facets.push({ key, label, buckets });
  }

  // Dynamic facets: only show with 2+ distinct values
  for (const { key, label } of DYNAMIC_FACETS) {
    const counts = new Map<string, number>();
    for (const hit of hits) {
      const val = String(hit[key] ?? "");
      if (val) counts.set(val, (counts.get(val) || 0) + 1);
    }
    if (counts.size < 2) continue;
    const buckets = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    facets.push({ key, label, buckets });
  }

  return facets;
}

export function applyFacetFilters(
  hits: SearchHit[],
  selection: FacetSelection
): SearchHit[] {
  return hits.filter((hit) => {
    for (const [key, values] of Object.entries(selection)) {
      if (values.size === 0) continue;
      const raw = (hit as unknown as Record<string, unknown>)[key];
      if (Array.isArray(raw)) {
        // For array fields (tags): hit must have at least one of the selected values
        const hitVals = raw.map(String);
        if (!hitVals.some((v) => values.has(v))) return false;
      } else {
        const hitVal = String(raw ?? "");
        if (!values.has(hitVal)) return false;
      }
    }
    return true;
  });
}

export function hasActiveFacets(selection: FacetSelection): boolean {
  return Object.values(selection).some((s) => s.size > 0);
}

export function FacetPanel({
  hits,
  selection,
  onSelectionChange,
}: FacetPanelProps) {
  const facets = useMemo(() => buildFacets(hits), [hits]);

  const toggle = (facetKey: string, value: string) => {
    const prev = selection[facetKey] ?? new Set<string>();
    const next = new Set(prev);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onSelectionChange({ ...selection, [facetKey]: next });
  };

  const clearAll = () => {
    const cleared: FacetSelection = {};
    for (const key of Object.keys(selection)) {
      cleared[key] = new Set<string>();
    }
    onSelectionChange(cleared);
  };

  const active = hasActiveFacets(selection);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          Filter by
        </span>
        {active && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground gap-1 text-[11px]"
            onClick={clearAll}
          >
            <X className="size-3" />
            Clear filters
          </Button>
        )}
      </div>
      {facets.map((facet) => {
        if (facet.buckets.length === 0) return null;
        return (
          <div key={facet.key} className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground w-14 shrink-0 text-[11px]">
              {facet.label}
            </span>
            {facet.buckets.map((bucket) => {
              const selected = selection[facet.key]?.has(bucket.value) ?? false;
              return (
                <Badge
                  key={bucket.value}
                  variant={selected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer gap-1 text-[11px] transition-colors",
                    !selected && "hover:bg-muted",
                    !selected && bucket.count === 0 && "opacity-40"
                  )}
                  onClick={() => toggle(facet.key, bucket.value)}
                >
                  {bucket.value}
                  <span
                    className={cn(
                      "tabular-nums",
                      selected
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {bucket.count}
                  </span>
                </Badge>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
