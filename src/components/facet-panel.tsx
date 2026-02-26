"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/components/search-results";

export type FacetSelection = Record<string, Set<string>>;

interface FacetBucket {
  value: string;
  count: number;
}

interface Facet {
  key: string;
  label: string;
  buckets: FacetBucket[];
  searchable?: boolean;
}

interface FacetDef {
  key: string;
  label: string;
  type: "string" | "array";
  knownValues?: string[];
  dynamic?: boolean;
  searchable?: boolean;
}

const PINNED_FACETS: FacetDef[] = [
  { key: "tags", label: "Tags", type: "array" },
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

const DYNAMIC_FACETS: FacetDef[] = [
  { key: "issue", label: "Issue", type: "string", dynamic: true, searchable: true },
];

function getHitValue(hit: SearchHit, key: string): string | string[] | undefined {
  return (hit as unknown as Record<string, unknown>)[key] as string | string[] | undefined;
}

function sortBuckets(buckets: FacetBucket[]): FacetBucket[] {
  return buckets.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
}

export function buildFacets(
  hits: SearchHit[],
  hiddenFacets?: string[]
): Facet[] {
  const hidden = new Set(hiddenFacets ?? []);
  const facets: Facet[] = [];

  for (const def of PINNED_FACETS) {
    if (hidden.has(def.key)) continue;

    const counts = new Map<string, number>();

    if (def.knownValues) {
      for (const v of def.knownValues) counts.set(v, 0);
    }

    for (const hit of hits) {
      const val = getHitValue(hit, def.key);
      if (val == null) continue;

      if (def.type === "array" && Array.isArray(val)) {
        for (const v of val) {
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      } else if (typeof val === "string" && val) {
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
    }

    const buckets: FacetBucket[] = [];
    for (const [value, count] of counts) {
      buckets.push({ value, count });
    }

    facets.push({ key: def.key, label: def.label, buckets: sortBuckets(buckets), searchable: def.searchable });
  }

  for (const def of DYNAMIC_FACETS) {
    if (hidden.has(def.key)) continue;

    const counts = new Map<string, number>();

    for (const hit of hits) {
      const val = getHitValue(hit, def.key);
      if (typeof val === "string" && val) {
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
    }

    if (counts.size < 2) continue;

    const buckets: FacetBucket[] = [];
    for (const [value, count] of counts) {
      buckets.push({ value, count });
    }

    facets.push({ key: def.key, label: def.label, buckets: sortBuckets(buckets), searchable: def.searchable });
  }

  return facets;
}

export function applyFacetFilters(
  hits: SearchHit[],
  selection: FacetSelection
): SearchHit[] {
  const activeKeys = Object.keys(selection).filter(
    (k) => selection[k] && selection[k].size > 0
  );
  if (activeKeys.length === 0) return hits;

  const allDefs = [...PINNED_FACETS, ...DYNAMIC_FACETS];
  const defMap = new Map(allDefs.map((d) => [d.key, d]));

  return hits.filter((hit) =>
    activeKeys.every((key) => {
      const set = selection[key];
      const def = defMap.get(key);
      const val = getHitValue(hit, key);

      if (def?.type === "array" && Array.isArray(val)) {
        return val.some((v) => set.has(v));
      }
      if (typeof val === "string") {
        return set.has(val);
      }
      return false;
    })
  );
}

export function hasActiveFacets(selection: FacetSelection): boolean {
  return Object.values(selection).some((s) => s && s.size > 0);
}

interface FacetPanelProps {
  hits: SearchHit[];
  selection: FacetSelection;
  onSelectionChange: (selection: FacetSelection) => void;
  hiddenFacets?: string[];
}

function SearchableFacetRow({
  facet,
  selected,
  onToggle,
}: {
  facet: Facet;
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedBuckets = facet.buckets.filter((b) => selected.has(b.value));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">
        {facet.label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px] font-normal"
          >
            {selected.size > 0
              ? `${selected.size} selected`
              : `${facet.buckets.length} issues`}
            <ChevronsUpDown className="size-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${facet.label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {facet.buckets.map((bucket) => {
                  const isSelected = selected.has(bucket.value);
                  return (
                    <CommandItem
                      key={bucket.value}
                      value={bucket.value}
                      onSelect={() => onToggle(bucket.value)}
                    >
                      <Check
                        className={cn(
                          "size-3.5",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{bucket.value}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground text-[11px]">
                        {bucket.count}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedBuckets.map((bucket) => (
        <Badge
          key={bucket.value}
          variant="default"
          className="cursor-pointer select-none gap-1 text-[11px]"
          onClick={() => onToggle(bucket.value)}
        >
          {bucket.value}
          <span className="tabular-nums opacity-75">{bucket.count}</span>
          <X className="size-2.5" />
        </Badge>
      ))}
    </div>
  );
}

export function FacetPanel({
  hits,
  selection,
  onSelectionChange,
  hiddenFacets,
}: FacetPanelProps) {
  const facets = useMemo(
    () => buildFacets(hits, hiddenFacets),
    [hits, hiddenFacets]
  );

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

  if (facets.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {facets.map((facet) => {
        const selected = selection[facet.key] ?? new Set<string>();

        if (facet.searchable) {
          return (
            <SearchableFacetRow
              key={facet.key}
              facet={facet}
              selected={selected}
              onToggle={(value) => toggle(facet.key, value)}
            />
          );
        }

        return (
          <div key={facet.key} className="flex items-center gap-2 flex-wrap">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">
              {facet.label}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {facet.buckets.map((bucket) => {
                const isSelected = selected.has(bucket.value);
                return (
                  <Badge
                    key={bucket.value}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer select-none text-[11px]",
                      !isSelected && "hover:bg-accent",
                      !isSelected && bucket.count === 0 && "opacity-40"
                    )}
                    onClick={() => toggle(facet.key, bucket.value)}
                  >
                    {bucket.value}
                    <span
                      className={cn(
                        "tabular-nums",
                        isSelected ? "opacity-75" : "text-muted-foreground"
                      )}
                    >
                      {bucket.count}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </div>
        );
      })}
      {active && (
        <Button
          variant="ghost"
          size="xs"
          className="self-start gap-1 text-muted-foreground text-[11px]"
          onClick={clearAll}
        >
          <X className="size-3" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
