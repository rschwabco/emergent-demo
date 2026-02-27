# Development Log

This document chronicles how **Emergent Demo** was built — a Next.js application that demonstrates Pinecone's vector search capabilities on a dataset of LLM agent conversation traces. The entire project was developed over two days (Feb 25–26, 2026) using AI-assisted coding in Cursor, with Claude as the coding agent.

The log covers not just *what* was built, but *why* — the design decisions, the debugging rabbit holes, the mid-course corrections, and how the human-AI collaboration actually played out.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Search backend:** Pinecone vector database (SDK v7)
- **LLM integration:** OpenAI (GPT-4o-mini) for query rewriting and result summarization
- **UI:** Tailwind CSS v4, shadcn/ui (Radix primitives), Lucide icons, next-themes
- **Testing:** Playwright (Chromium, Firefox, WebKit)

---

## Day 1 — Tuesday, Feb 25 2026

### Project Bootstrap

Scaffolded a new Next.js app with `create-next-app`. Added shadcn/ui component library, Tailwind CSS, next-themes for dark mode, and the Pinecone SDK. Set up the initial layout with theme support and base styling.

> `fc4a3e5` Initial commit from Create Next App
> `24b0dce` Update dependencies and enhance layout with theme support

### Core Search & Explore

Built the primary search experience: a search bar that sends queries to Pinecone for semantic (vector) search, and an explore mode that probes the index with curated topic queries to surface interesting patterns in the data. Created the trace viewer page (`/trace/[traceId]`) for inspecting full LLM conversations.

Key components: `SearchBar`, `SearchResults`/`ResultCard`, `TopicCard`, `TraceConversation`, `RoleBadge`, `FilterPanel`.

API routes: `/api/search` (semantic), `/api/explore` (topic probes), `/api/context` (surrounding chunks), `/api/trace/[traceId]` (full conversation), `/api/pinecone` (index metadata).

> `24b0dce` Implement search functionality and improve styling

### Back Navigation

Added a back button to return from search results to the landing view without losing state.

> `2fb1f68` Add back navigation button to reset search state

### Text (Lucene) Search

Added a second search input for keyword/text search using Pinecone's REST API with Lucene query syntax. At this point, semantic and keyword search lived in separate inputs — users chose one or the other.

> `916f282` Add text (Lucene) search alongside semantic search

### Tag Management System

Built a client-side tagging system. Users can create tags, assign them to search result chunks, and filter by tag. Tags were persisted to localStorage initially, with a background sync to Pinecone metadata via `/api/tags`. The `useTagStore` hook managed all tag state, assignments, and persistence.

> `044ecb7` Enhance search functionality and tag management
> `8c41374` Refactor displayHits to use useMemo; load tagStore from server

### LLM-Powered Dashboard

Integrated OpenAI and built an analytics dashboard that uses LLM calls to summarize patterns in the data. The dashboard samples records from Pinecone, groups them, and presents behavioral patterns (`BehaviorCard`), per-framework breakdowns (`ProjectBreakdown`), role distributions, and cross-cutting insights. Added caching to avoid redundant LLM calls.

> `596a714` Integrate OpenAI SDK and refactor dashboard components
> `7afa73e` Add caching mechanism for dashboard API

### Results Summary & Job Tracking

Added an LLM-powered results summarizer with background job tracking so summaries don't block the UI.

> `863faa0` Add ResultsSummary and SummaryJobTracker components
> `2a18aba` Implement project selection; enhance ProjectBreakdown interactivity
> `f4bee68` Refactor hit structure for consistency

---

## Day 2 — Wednesday, Feb 26 2026

### Dynamic Index & Namespace Support

Refactored all API routes to accept dynamic `indexName` and `namespace` parameters instead of hardcoded values. Created the `IndexDashboard` component (`/index/[indexName]/page.tsx`) as the main per-index view.

> `ec77c27` Refactor API routes to support dynamic index and namespace parameters

### Unified Search & Faceted Filtering

This was the largest single change, and the first feature that was **spec'd before implementation**. The spec ([`SPEC-facets-and-optimistic-tags.md`](SPEC-facets-and-optimistic-tags.md)) defined the data model, component API, rendering rules, and behavioral requirements upfront. The implementation then followed a plan-then-execute workflow.

**Unified search.** Merged the separate semantic and keyword search inputs into a single search bar that runs both in parallel and deduplicates results using Reciprocal Rank Fusion (RRF).

**Facet panel.** Replaced the two-dropdown `FilterPanel` with a badge-based `FacetPanel`. Facets are computed client-side from the loaded result set:
- *Pinned facets* (Tags, Role, Framework) always show with known values
- *Dynamic facets* (Trace) appear only when results have 2+ distinct values
- Multi-select within a facet (OR logic), cross-facet AND logic
- Hit counts on every badge, zero-count badges at reduced opacity

**Optimistic tag updates with rollback.** Refactored `useTagStore` to capture state snapshots before mutations and roll back on API failure. Changed `persistToPinecone` from fire-and-forget to `Promise<boolean>`.

**Text selection guard.** Added `window.getSelection()` check in card click handlers so highlighting text no longer triggers navigation.

#### Debugging: React state updater timing

During implementation, Claude caught a subtle concurrency bug in its own code. The `assignTag` function declared an `updates` array outside `setAssignments` but populated it inside the state updater callback. In React 18 with automatic batching, the updater runs asynchronously during the render phase — so by the time `persistToPinecone(updates)` was called, the array was still empty. The fix: compute updates from `assignmentsRef.current` *outside* the updater callback.

#### Debugging: Tailwind + pnpm resolution crisis

After the facet implementation was complete, the dev server broke with `Can't resolve 'tailwindcss'` errors. The root cause was pnpm's strict isolation mode conflicting with Turbopack's CSS resolver. The fix went through three iterations:
1. `public-hoist-pattern` in `.npmrc` — didn't work
2. `shamefully-hoist=true` — still broken
3. `node-linker=hoisted` — finally replicated npm's flat `node_modules` layout and resolved the issue

> `b0c5eaf` Unify search, add faceted filters, and persist tags to Pinecone
> `48ba864` Refactor IndexDashboard to use FacetPanel

### Facet Panel: Iterative Refinement

The facet panel went through several rounds of refinement driven by direct user observation.

**Missing facets on landing page.** The user noticed facets weren't showing on the landing page. Root cause: the landing page passed an empty `hits` array to `FacetPanel`. Fix: create a `behaviorHits` memo that collects sample hits from dashboard behavior cards to seed facet counts.

**Too many trace values.** The Trace facet had too many values for a badge layout. The user said: *"for the issues facets, we should probably use a searchable drop down, there's just too many values here."* Added a `searchable` flag to `FacetDef` and built a Popover+Command combobox for high-cardinality facets.

**The double-Tags mystery.** The user spotted two "Tags" elements — an empty one in the facet panel and a working `TagFilter` below it. *"We have two 'Tags' — one in facets and then below all the facets. The top one is empty. What's going on?"* Investigation revealed that `hit.tags` was always `[]` because tags lived in `useTagStore` (localStorage + Pinecone sync) separately from the hit objects. The semantic search API returned tags from metadata, but keyword search hardcoded `tags: []`, and behavior hits also had empty tags. The fix: create `enrichedFacetHits` and `enrichedSourceHits` memos that merge tag store data into hit objects before passing to the panel.

**Framework facet zero counts.** All framework values showed `0`. This launched a deep debugging session tracing data through `buildFacets` → `getHitValue` → `SearchHit` type → API routes → Pinecone records. The AI explored multiple hypotheses (capitalization mismatch? missing field? trace ID format?) before discovering the root cause: cached dashboard data still had the old `projects` key after a terminology rename. Fix: make `frameworks` optional in `DashboardData` and add optional chaining.

**Design mismatch.** The user shared a screenshot showing the facet area looked "out of place" compared to the rest of the app. The AI audited the app's design language — card containers with borders, colored icon badges, section headers — and realized the facets were "raw badges floating in space with no card container." Fix: wrapped in a `rounded-lg border bg-card/50` container with a Filter icon header, matching the dashboard's card-based sections. Restyled "Try:" suggestions as softer `rounded-full bg-muted/50` pills to visually distinguish them from filter badges.

### Enhanced Search Pipeline

This work started with a message from a colleague: *"The main thing to do is 1) improve the search quality if possible and 2) find some good queries to demo."*

#### Phase 1: Architecture analysis

The AI analyzed the existing hybrid search pipeline (semantic + keyword via RRF with k=60, topK=15) and identified the key insight: *"RRF is rank-position-based and content-blind. The reranker adds cross-encoder content understanding."* A reranker was already wired up in `/api/search` but unused in the main `/api/hybrid-search` path — low-hanging fruit.

#### Phase 2: Multi-stage pipeline implementation

Built a five-stage search pipeline:
1. **Query rewriting** — GPT-4o-mini rewrites the user query into multiple variants (synonym expansion, rephrasing) via `/api/query-rewrite`
2. **Fan-out search** — runs all query variants through both semantic and keyword search in parallel
3. **RRF fusion** — merges results using Reciprocal Rank Fusion
4. **Reranking** — applies Pinecone's `pinecone-rerank-v0` model to re-score the fused results
5. **Deduplication** — removes duplicate chunks across queries

The AI debated where to put the multi-query fan-out. Calling the existing `hybrid-search` route N times would trigger N separate reranks (wasteful). Client-side fan-out had portability issues. Making HTTP calls between Next.js API routes on the same server is unreliable in serverless. Final decision: extract shared search logic into `src/lib/search.ts` and orchestrate server-side.

Also hardened Lucene query generation with proper escaping and phrase boosting, and increased the candidate pool from `topK*2` to `topK*4`.

#### Debugging: Pinecone SDK API shape

The build failed because `pc.inference.rerank` in SDK v7 takes a single options object, not four positional arguments. Caught from the TypeScript error and fixed.

#### Debugging: Score normalization

The user noticed: *"All the matches are up to 10% which seems wrong."* The `pinecone-rerank-v0` model produces relevance scores in the 0.03–0.10 range (not probabilities). Implemented min-max normalization relative to the top result in each set so scores display as meaningful percentages.

> `5de0d30` Refactor hybrid search; integrate query rewrites
> `dae8b03` Update curated queries; improve semantic explanations
> `a60243a` Add auto-expanding behavior patterns

### Search Comparison Page

The user asked: *"Propose candidate queries that would showcase the benefit of using a vector search as opposed to just normal keyword search. Execute the queries against our backend, evaluate their quality, and continue until you find 10 good queries."*

The AI wrote and executed a Node.js script that ran 34 candidate queries against both semantic-only and keyword-only endpoints. Key findings:
- 8 of 10 curated queries had **zero overlap** between keyword and vector results
- "complex" matched mathematical complex numbers (sympy) instead of "complicated/multi-part"
- "approach" was too generic for keyword search, matching everywhere
- "preserving" matched Django test runner output ("Preserving test database for alias 'other'...")

Built a side-by-side comparison page (`/compare`) showing the 10 curated queries. Then the user drove five rapid UX iterations:
1. *"Explanation should come first and then the actual results"*
2. *"The vector search result should be on the left"*
3. *"You should show what query was used for each vector search and query search"*
4. *"The scores for vector search and keyword search should be normalized"*
5. *"The tags here don't make quite sense. Why is Behavioral Pattern a tag?"* — This corrected a category naming mistake: labels should describe *why keyword search fails* (vocabulary mismatch, polysemy) not *what the query is about*

The AI exported `buildLuceneQuery` from `search.ts` so both the actual search and the comparison UI could display the exact Lucene query being sent, making the difference between vector embedding and keyword tokenization visually concrete.

### Terminology Refactor

The user observed: *"We use the word 'Issues' here but these are not 'issues' — they are 'traces'. Also they are not projects, they are 'frameworks'."*

This triggered a rename across ~25 files: type definitions, API routes, component names (`ProjectBreakdown` → `FrameworkBreakdown`), facet keys, and UI labels. The AI carefully distinguished between field names to rename vs. natural language to preserve (e.g., the search query "reading error traceback to diagnose the issue" keeps "issue" since it's conversational).

After the rename, the app crashed: `Cannot read properties of undefined (reading 'length')` at `dashboard.frameworks.length`. Root cause: cached dashboard data still used the old `projects` key. Fix: make `frameworks` optional and add optional chaining — a backward-compatibility lesson about cached server data surviving code renames.

> Part of `310a7e8`

### Result Card UX

The user made two direct UX calls: *"Disable clicking on a result entry — it should just do nothing"* and *"add a button to copy the content of the chunk."* Clean execution: removed the click handler and `cursor-pointer`, added a Copy button with clipboard feedback. The existing action buttons (Find similar, Expand, View trace) remained.

### Auto-Expanding Behavior Patterns

The user asked for seamless background expansion: *"Our behavior pattern section should just be automatically expanded. We start by showing the 25 chunks but immediately kick off the 'discover more' and just show it when it's updated."*

The UX intent: show initial results immediately (fast perceived load), then silently upgrade in the background. Removed the manual "Discover more" button, added a subtle "Discovering more..." spinner, and added an `activeIndexRef` guard to prevent stale responses from overwriting data if the user navigates away.

### Dashboard Stats Removal

The user looked at the landing page and decided: *"Let's remove the section with 'Chunks indexed' and '10 behavior patterns', it's not helpful. You can give me like a count at the top in the selector for the index."* Removed `DashboardStats`, moved chunk count inline next to the index selector (`4.2K chunks`), cleaned up the orphaned walkthrough tour step.

### Branch Merge & Environment Config

Merging the development branch (`roie`) into `main` required resolving 10 conflicts. The user initially said *"create a PR that merges the 'roie' branch into main"* — then corrected the remote target: *"I need to do this against the remote 'github'"* (the `pinecone-io` org, not the personal fork).

Key merge decision: keep the `roie` branch's more evolved approach (dynamic index/namespace, searchable facets, source badges, bulk tags) while incorporating `main`'s additions (tags in explore results).

Post-merge, the app crashed because `pinecone.ts` imported from a non-existent `env.json` file (gitignored). The `main` branch used JSON config; the `roie` branch used `process.env`. Rewired to environment variables with sensible defaults.

> `5936345` Merge github/main into roie — resolve conflicts
> `20abea1` Replace env.json import with process.env
> `cd3728b` Merge pull request #1

### E2E Test Suite

The user asked for Playwright tests as part of a CI pipeline. A key decision point: **real APIs vs mocks**. The user chose real API keys stored as GitHub Secrets, which shaped the CI architecture — the workflow needed `PINECONE_API_KEY` and `OPENAI_API_KEY` injected as secrets. When asked whether to add these as GitHub "variables" or "secrets," the AI clarified: secrets (encrypted, masked in logs) for API keys.

Created 11 tests across 3 spec files (navigation, search, trace) with a GitHub Actions workflow.

> Part of `310a7e8`

### TypeScript Config Fix

The user reported: *"Please fix our poor tsconfig.json. He is sad and full of errors."*

This turned into the most tortuous debugging session of the project. The IDE's TypeScript server was constructing pnpm virtual store paths (`.pnpm/@types+node@20.19.35/...`) that didn't exist because `node-linker=hoisted` puts packages directly in `node_modules/`. The CLI (`tsc --noEmit`) passed cleanly — only the IDE was broken.

The AI tried at least 8 approaches: `pnpm install`, removing `typeRoots`, adding explicit `types`, deleting `node_modules/.pnpm`, deleting `.modules.yaml`, `preserveSymlinks: true`, clean reinstall. Each time the user reported the IDE still showed errors.

The breakthrough insight: *"pnpm's hoisted mode creates a `.pnpm` metadata directory that TypeScript 5.x interprets as a full pnpm virtual store, then tries to resolve type packages through paths that don't exist."* Fix: switch from `node-linker=hoisted` to `shamefully-hoist=true` (pnpm isolated mode with hoisting) so the `.pnpm` virtual store is properly populated. Changed `jsx` from `"react-jsx"` to `"preserve"` (Next.js standard).

The core frustration throughout: changes that fixed the CLI weren't picked up by the IDE because the TypeScript language server was caching stale resolutions.

### UI Polish

Final refinements bundled into the last commit:
- **Walkthrough component** — guided onboarding tour with `data-tour` anchors
- **Facet panel redesign** — bordered card, Filter icon header, "Clear all" in header
- **Search suggestions** — pill-shaped badges with softer colors
- **Chunk count** — inline next to index selector
- **Result cards** — click disabled, copy button added

> `310a7e8` Rename project/issue to framework/trace, add e2e tests, and polish UI

---

## Architecture Overview

```
src/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── search/             # Semantic vector search
│   │   ├── text-search/        # Keyword (Lucene) search
│   │   ├── hybrid-search/      # Combined semantic + keyword with RRF
│   │   ├── enhanced-search/    # Multi-query fan-out + reranking
│   │   ├── compare-search/     # Side-by-side keyword vs vector
│   │   ├── query-rewrite/      # LLM query expansion
│   │   ├── explore/            # Topic probe queries
│   │   ├── dashboard/          # LLM-powered analytics
│   │   ├── summarize-results/  # Result summarization
│   │   ├── tags/               # Tag CRUD + filtering
│   │   ├── context/            # Surrounding chunk fetch
│   │   ├── trace/[traceId]/    # Full conversation fetch
│   │   └── upload/             # Data upload
│   ├── compare/                # Search comparison page
│   ├── index/[indexName]/      # Per-index dashboard
│   ├── trace/[traceId]/        # Trace viewer page
│   └── upload/                 # Upload page
├── components/                 # React components
│   ├── ui/                     # shadcn/ui primitives
│   ├── facet-panel.tsx         # Badge-based faceted filtering
│   ├── search-bar.tsx          # Unified search input
│   ├── search-results.tsx      # Result cards with scoring
│   ├── walkthrough.tsx         # Guided onboarding tour
│   └── ...
├── hooks/
│   └── use-tag-store.ts        # Tag management with optimistic updates
└── lib/
    ├── pinecone.ts             # Pinecone client setup
    ├── openai.ts               # OpenAI client setup
    ├── search.ts               # Search utilities (RRF, dedup, Lucene)
    ├── explore-probes.ts       # Curated topic queries
    └── ...                     # Caching utilities
```

---

## Key Design Decisions

1. **Client-side facet filtering.** All facet filtering happens in the browser on the loaded result set rather than re-querying Pinecone. This makes filter toggling instant. The tradeoff is that facet counts only reflect the loaded results, not the full index — acceptable for a demo app where result sets are small.

2. **Optimistic tag mutations with rollback.** Tag changes appear instantly in the UI. If the Pinecone API call fails, the state silently reverts — no loading spinners or error modals. This was spec'd explicitly: *"Rollback is silent — if the API fails, the UI reverts without a toast or modal. Errors are logged to console."*

3. **Hybrid search with RRF.** Semantic and keyword searches run in parallel. Results are merged using Reciprocal Rank Fusion, chosen because it's rank-position-based and doesn't require score normalization across different scoring systems (vector cosine similarity vs. BM25).

4. **Reranking after fusion, not before.** An early design considered reranking within each search path, but that would mean N rerank calls for N query variants. Instead, reranking happens once at the end of the pipeline, after RRF fusion — one cross-encoder pass over the merged candidate set.

5. **LLM query rewriting for recall.** The search pipeline rewrites user queries into multiple variants to catch vocabulary mismatches. The comparison page proved this matters: 8 of 10 curated queries had zero overlap between keyword and vector results, showing that users' natural language often doesn't match document terminology.

6. **Spec-driven development.** The faceted filtering system was specified in a markdown document before implementation, defining the data model, component API, and behavioral requirements. This paid off — the implementation session was focused on execution rather than design debates, and the spec served as a reference when later refinements were needed.

7. **Extracted search logic.** Rather than having API routes call each other over HTTP (unreliable in Next.js serverless), shared search logic (RRF, Lucene query building, deduplication) was extracted into `src/lib/search.ts` and imported directly.

---

## Lessons Learned

- **Cached data survives code renames.** Renaming `project` → `framework` in code doesn't rename it in cached API responses or Pinecone metadata. Always add backward compatibility for stored data.

- **pnpm + Turbopack + TypeScript is a minefield.** pnpm's strict isolation creates `.pnpm` directories that TypeScript's module resolution interprets as virtual stores. The IDE's TypeScript server caches resolutions aggressively, so fixes that work on the CLI don't always propagate. `shamefully-hoist=true` was the pragmatic solution.

- **Score normalization matters for UX.** Raw reranker scores (0.03–0.10) look broken to users. Min-max normalization relative to the top result makes scores interpretable without changing ranking.

- **The AI catches its own bugs.** The React state updater timing bug and Pinecone SDK API shape error were both caught during code generation, not by the user testing. Self-review during generation is a real benefit of AI-assisted coding.

- **Users steer through observation.** Most design improvements came from the user observing the running app and making terse corrections: *"the framework tag shows 0 count"*, *"all matches are up to 10%"*, *"we have two Tags"*. The AI diagnosed root causes from minimal bug reports.

---

*Built with [Cursor](https://cursor.sh) and Claude.*
