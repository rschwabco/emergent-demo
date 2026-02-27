# Spec: Faceted Filtering & Optimistic Tag Updates

**Goal:** Port features from `emergent-demo` that are absent in this project. These are: a badge-based facet panel with dynamic facets, optimistic tag mutation with server-authoritative rollback, trace-level filtering, and a text-selection guard on result card clicks.

---

## 1. Replace FilterPanel with FacetPanel

### Problem

The current `FilterPanel` uses two `<Select>` dropdowns (role, framework). This limits filtering in several ways:

- Only one value can be selected per dimension (no multi-select).
- Users cannot see how many results match each filter value.
- No way to filter by trace, tags, or other metadata dimensions.
- Filters are disconnected from results — users must guess which values are useful.

### Solution

Replace the `FilterPanel` component with a new `FacetPanel` component that renders filter dimensions as rows of clickable badges with hit counts.

### Design

#### Data Model

```typescript
export type FacetSelection = Record<string, Set<string>>;

interface Facet {
  key: string;
  label: string;
  buckets: { value: string; count: number }[];
}
```

#### Two Facet Categories

**Pinned facets** always render, even when no results are loaded. They have hardcoded known values so empty states still show the full list (with `0` counts).

| Facet | Key | Type | Known Values |
|-------|-----|------|-------------|
| Tags | `tags` | `array` | *(derived from hits)* |
| Role | `role` | `string` | `system`, `user`, `assistant`, `tool` |
| Framework | `framework` | `string` | `django`, `scikit-learn`, `matplotlib`, `pytest-dev`, `sympy`, `astropy`, `sphinx-doc`, `pallets` |

**Dynamic facets** only render when the current result set contains 2+ distinct values for that dimension. They disappear when irrelevant.

| Facet | Key | Type |
|-------|-----|------|
| Trace | `trace` | `string` |

#### Component API

```typescript
interface FacetPanelProps {
  hits: SearchHit[];
  selection: FacetSelection;
  onSelectionChange: (selection: FacetSelection) => void;
}
```

The panel is a **controlled component**. The parent owns `selection` state and passes it down. This allows the parent to reset facets on new searches and use the selection for client-side filtering.

#### Rendering

Each facet renders as a horizontal row:

```
[label]  [badge value₁ count₁] [badge value₂ count₂] ...
```

- The label is a fixed-width `<span>` (e.g. `w-14`, `text-[11px]`, muted color).
- Each badge uses the shadcn `<Badge>` component.
  - **Unselected:** `variant="outline"`, muted hover. If count is `0`, apply `opacity-40`.
  - **Selected:** `variant="default"` (filled).
- Counts display inside the badge in `tabular-nums`, slightly muted relative to the value text.
- Clicking a badge toggles that value in the facet's `Set`.
- A "Clear filters" button appears (using the `X` icon) whenever any facet has a non-empty selection. Clicking it resets all sets to empty.

#### `buildFacets(hits)` Logic

1. For each pinned facet, iterate all hits and count occurrences of each value.
   - For `array` type fields (tags): iterate the array, count each unique value.
   - For `string` type fields: count the string value directly.
   - If the facet has `knownValues`, ensure all known values appear in the buckets (with `0` count if not present in hits).
   - Sort buckets by count descending, then alphabetically.
2. For each dynamic facet, iterate all hits and count occurrences.
   - If fewer than 2 distinct values exist, **skip** the facet entirely.
   - Sort buckets by count descending.

#### `applyFacetFilters(hits, selection)` Logic

Filter the hit array client-side:

- For each facet key with a non-empty selection set:
  - If the hit's field is an array (tags): the hit passes if **at least one** of its values is in the selection set.
  - If the hit's field is a string: the hit passes if its value is in the selection set.
- A hit must pass **all** active facet filters (AND logic across facets, OR logic within a facet).

#### `hasActiveFacets(selection)` Helper

Returns `true` if any set in the selection record has `.size > 0`.

### Integration into IndexDashboard

1. Remove the `role` and `framework` state variables and their `useRef` counterparts.
2. Add `facetSelection` / `setFacetSelection` state (`FacetSelection`, initialized to `{}`).
3. Replace `<FilterPanel>` with `<FacetPanel hits={...} selection={facetSelection} onSelectionChange={setFacetSelection} />`.
4. On the landing page (no search), pass the behavior card sample hits as the facet source (so users see counts from the dashboard data).
5. On search, pass the raw `hits` array as the facet source.
6. Compute `displayHits` by applying `applyFacetFilters(hits, facetSelection)` via `useMemo`.
7. Reset `facetSelection` to `{}` on every new search.
8. Update `doSearch` to no longer pass `role`/`framework` as server-side filters. Instead, all filtering happens client-side via the facet panel. This simplifies the API call and makes filter changes instant (no re-fetch).

### Interaction with TagFilter

The existing `TagFilter` component provides a dedicated tag filtering experience (single-tag filter via the `/api/tags/filter` endpoint). The new `FacetPanel` also includes a "Tags" facet row.

These serve different purposes:
- **FacetPanel Tags row:** Client-side multi-select filter on the currently loaded result set. Fast, no API call.
- **TagFilter:** Server-side single-tag query that fetches all records with that tag from Pinecone, regardless of current search.

Both should coexist. The FacetPanel Tags row filters within current results; TagFilter replaces the result set entirely.

### Showing Frameworks Conditionally

The current `FilterPanel` only shows the framework dropdown when `activeIndex === "agent-traces-semantic"`. The `FacetPanel` should adopt the same behavior: the "Framework" pinned facet should only appear when the active index is `agent-traces-semantic`. Pass an optional `indexName` prop to `FacetPanel`, or conditionally include the Framework facet in `PINNED_FACETS` based on the index.

Recommended approach: accept an optional `hiddenFacets?: string[]` prop. When the index is not `agent-traces-semantic`, pass `hiddenFacets={["framework"]}`.

---

## 2. Optimistic Tag Mutations with Rollback

### Problem

The current `useTagStore` hook in this project uses a **dual-write** strategy: it updates localStorage immediately and fires a Pinecone PATCH in the background. If the API call fails, there is no rollback — the local state drifts from the server.

### Solution

Add rollback logic to `assignTag` and `unassignTag`. On API failure, revert the local state to its pre-mutation value.

### Changes to `useTagStore`

#### `assignTag(hitIds, tag)`

Current behavior:
1. Update `tags` state (add tag if new).
2. Update `assignments` state (add tag to each hit).
3. Fire `persistToPinecone(updates)` — fire-and-forget.

New behavior:
1. Capture a snapshot of the `assignments` for the affected `hitIds` before mutation.
2. Update `tags` and `assignments` state optimistically (same as now).
3. Call `persistToPinecone(updates)` but **handle the promise**:
   - On success (or if the function is void): no action needed.
   - On failure: revert `assignments` for each affected `hitId` to the snapshot values. If a tag was newly created (not in the pre-mutation `tags` list) and no other hit has it, remove it from `tags`.

#### `unassignTag(hitId, tag)`

Current behavior:
1. Update `assignments` (remove tag from hit).
2. Fire `persistToPinecone` — fire-and-forget.

New behavior:
1. Capture the hit's current tag list.
2. Update `assignments` optimistically.
3. Handle the `persistToPinecone` promise:
   - On failure: restore the tag to the hit's assignment list.

#### `persistToPinecone` Return Type

Change `persistToPinecone` from a fire-and-forget `void` function to one that returns a `Promise<boolean>` indicating success/failure:

```typescript
async function persistToPinecone(
  updates: Array<{ id: string; tags: string[] }>,
  indexName?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, ...(indexName && { indexName }) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    console.error("Failed to persist tags to Pinecone:", err);
    return false;
  }
}
```

#### localStorage Sync

The existing localStorage persistence continues as-is. On rollback, the state update will trigger the `useEffect` that writes to localStorage, so it stays in sync automatically.

---

## 3. Trace-Level Filtering (via FacetPanel)

### Problem

The `SearchHit` type already includes a `trace` field (extracted from `traceId` in the format `{framework}__{trace}.json`), but there is no UI to filter by trace.

### Solution

This is handled by the FacetPanel's dynamic facets (Section 1). The `trace` field is registered as a dynamic facet that only appears when results contain 2+ distinct traces.

No additional API or data changes are needed — the `trace` field is already present on every `SearchHit`.

---

## 4. Text Selection Guard on Result Card Clicks

### Problem

When a user clicks on a result card, it triggers either "find similar" or selection toggle. If the user was trying to select/copy text from the card, the click handler fires unexpectedly, causing a jarring experience.

### Solution

Add a selection check at the top of `handleCardClick` in the `ResultCard` component.

### Change in `search-results.tsx`

In the `ResultCard` component's `handleCardClick` function, add:

```typescript
const handleCardClick = () => {
  const sel = window.getSelection();
  if (sel && sel.toString().length > 0) return;

  if (selectionActive) {
    onSelect(hit.id, !selected);
  } else {
    onFindSimilar?.(hit);
  }
};
```

This is a single two-line addition at the top of the existing handler.

---

## 5. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/facet-panel.tsx` | **Create** | New FacetPanel component with `buildFacets`, `applyFacetFilters`, `hasActiveFacets` |
| `src/components/filter-panel.tsx` | **Delete** (or keep for reference) | Replaced by FacetPanel |
| `src/app/index/[indexName]/page.tsx` | **Modify** | Replace FilterPanel with FacetPanel; remove `role`/`framework` state; add `facetSelection` state; update `displayHits` to use `applyFacetFilters`; reset facets on new search |
| `src/hooks/use-tag-store.ts` | **Modify** | Add rollback logic to `assignTag` and `unassignTag`; change `persistToPinecone` to return `Promise<boolean>` |
| `src/components/search-results.tsx` | **Modify** | Add `window.getSelection()` guard in `handleCardClick` |

---

## 6. Behavioral Requirements

1. **Facet counts update live** as hits change (new search, tag mutation, tag filter).
2. **Multi-select within a facet** uses OR logic (show hits matching any selected value).
3. **Cross-facet filtering** uses AND logic (hit must pass all facets).
4. **Dynamic facets appear/disappear** based on result diversity — no empty facet rows for dynamic facets.
5. **Pinned facets always show**, even with zero results, using known values with `0` counts.
6. **Optimistic mutations are instant** — no loading spinners for tag add/remove.
7. **Rollback is silent** — if the API fails, the UI reverts without a toast or modal. Errors are logged to console.
8. **Text selection does not trigger actions** — users can highlight and copy text from result cards without side effects.

---

## 7. Out of Scope

- Server-side faceted search (all facet filtering is client-side on the loaded result set).
- Facet value search/autocomplete within the facet panel.
- Persisting facet selection in URL params.
- Changes to the TagFilter component (it continues to work as-is alongside the FacetPanel).
- Changes to any API routes.
