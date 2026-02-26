"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "@/components/role-badge";
import {
  Search,
  ArrowLeft,
  Brain,
  Type,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Hit {
  id: string;
  score: number;
  chunkText: string;
  role: string;
  traceId: string;
  turnIndex: number;
  chunkIndex: number;
  project: string;
  issue: string;
  tags: string[];
}

interface CompareResult {
  semantic: Hit[];
  keyword: Hit[];
  meta: {
    semanticCount: number;
    keywordCount: number;
    overlap: number;
    semanticOnly: number;
    keywordOnly: number;
  };
  queries: {
    semantic: string;
    keyword: string;
  };
}

interface CuratedQuery {
  query: string;
  whyVectorWins: string;
  withoutVector: string;
  category: string;
}

const CURATED_QUERIES: CuratedQuery[] = [
  {
    query: "modifying database schema while preserving backwards compatibility",
    category: "Vocabulary Mismatch",
    whyVectorWins:
      'Keyword search matches "preserving" to test runner output ("Preserving test database for alias…") and "database" to generic DB mentions. Vector search understands the intent — finding discussions about schema evolution with compatibility constraints — and returns Django migration operations and backward-compat design analysis.',
    withoutVector:
      "Pages of noisy Django test runner output and unrelated astropy unit conversion tests that happen to contain the words \"backwards\" and \"preserving.\"",
  },
  {
    query: "handling circular imports in Python",
    category: "Concept vs. Token",
    whyVectorWins:
      "Keyword matched \"circular\" in a Sphinx toctree warning about circular page references — a completely different concept. Vector search found the actual Django __init__.py with isort:skip comments used to avoid circular imports, a Sphinx agent blocked by circular imports during testing, and a pylint agent reasoning about import resolution.",
    withoutVector:
      "Polluted results mixing circular page references, circular data structures, and actual circular imports — no way to disambiguate.",
  },
  {
    query: "agent backtracks after realizing its initial fix was wrong",
    category: "Behavioral Pattern",
    whyVectorWins:
      "This describes a behavioral pattern (backtracking). There's no single keyword that captures it. The semantic model found turns where agents are mid-iteration — checking if a fix was executed, discovering results don't match expectations, reverting and trying again — using words like \"Let me check if our fix is actually being executed\" and \"the fix isn't working as expected.\"",
    withoutVector:
      "Scattered results where the words \"fix\" and \"wrong\" happen to co-occur, regardless of whether the agent is actually backtracking.",
  },
  {
    query: "agent realizes the bug is in a different file than expected",
    category: "Behavioral Pattern",
    whyVectorWins:
      "Keyword search treated \"different\" and \"expected\" as tokens and matched test assertion messages. Vector search found actual aha moments — a Sphinx agent discovering wrong variable scope linking, a sympy agent finding a second copy of a file in /testbed/ — the real discovery moments with almost no keyword overlap.",
    withoutVector:
      "Test output comparisons showing \"different from expected\" values — about assertion failures, not discovery moments.",
  },
  {
    query: "successfully fixing a complex multi-file bug",
    category: "Polysemy",
    whyVectorWins:
      "Keyword search was misled by \"complex\" matching mathematical complex numbers in sympy (is_zero property, complex denominators). Vector search understood \"complex\" as complicated/multi-part and found agents completing fixes across multiple files and running final verification.",
    withoutVector:
      "The entire first page would be sympy complex number arithmetic, completely missing the query intent.",
  },
  {
    query: "patching test fixtures to isolate behavior",
    category: "Concept vs. Token",
    whyVectorWins:
      "Keyword found Django fixture test output (lists of test names like test_loaddata_with_valid_fixture_dirs) because \"fixture\" appeared. Vector search found pytest agents reasoning about isolation strategy — when to apply patches, how to create isolated environments, how to verify patches work correctly.",
    withoutVector:
      "Django fixture test runner output listings instead of actual patching strategy discussions.",
  },
  {
    query: "methodical approach to reproducing the bug",
    category: "Vocabulary Mismatch",
    whyVectorWins:
      "\"Approach\" is a generic word. Keyword returned results where agents mention \"different approach\" in any context. Vector search found the structured debugging methodology — \"create a minimal reproduction script\" — which is semantically about methodical reproduction. None of the top semantic results contain the word \"methodical.\"",
    withoutVector:
      "Random discussions about various \"approaches\" to unrelated problems.",
  },
  {
    query: "verifying the fix doesn't break existing functionality",
    category: "Synonym Coverage",
    whyVectorWins:
      "Keyword works partially here — it finds results that literally say \"doesn't break existing functionality.\" But vector search also found conceptual equivalents using different language: \"comparing behavior before and after the fix\", \"Backward Compatibility\" checklists, \"enables the refactoring scenario\" — different ways agents express verification.",
    withoutVector:
      "Only results using that exact phrasing. You'd miss the broader set of verification behaviors expressed differently.",
  },
  {
    query: "minimal targeted change instead of a broad refactor",
    category: "Polysemy",
    whyVectorWins:
      "Keyword found pylint config output where \"refactor\" is a lint category name (error + warning + refactor + convention), not a development decision. Vector search found agents choosing minimal changes, reverting broader fixes, and explicitly noting \"Minimal Change\" in reviews.",
    withoutVector:
      "Pylint scoring formulas that mention \"refactor\" as a variable name mixed with unrelated results.",
  },
  {
    query: "careful code review before submitting the final solution",
    category: "Synonym Coverage",
    whyVectorWins:
      "Both found \"FINAL REVIEW\" sections, but keyword matched fragments where \"careful\" or \"review\" appeared in passing. Vector search found the structured review methodology — instructions to \"compare your changes with the base commit\" and \"ensure you've fully addressed all requirements\" — the actual review process, not incidental mentions.",
    withoutVector:
      "Fragments mentioning \"careful\" in unrelated contexts (\"Let me revert to a more careful approach\") mixed with generic review mentions.",
  },
];

const CATEGORY_STYLES: Record<string, string> = {
  "Vocabulary Mismatch":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "Concept vs. Token":
    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "Behavioral Pattern":
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  Polysemy:
    "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  "Synonym Coverage":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
};

function truncate(text: string, maxLen = 220) {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function HitCard({
  hit,
  rank,
  otherIds,
  source,
  maxScore,
}: {
  hit: Hit;
  rank: number;
  otherIds: Set<string>;
  source: "semantic" | "keyword";
  maxScore: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const inOther = otherIds.has(hit.id);
  const pct = maxScore > 0 ? (hit.score / maxScore) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        inOther
          ? "border-emerald-500/30 bg-emerald-500/5"
          : source === "semantic"
            ? "border-violet-500/20 bg-violet-500/5"
            : "border-sky-500/20 bg-sky-500/5"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <RoleBadge role={hit.role} />
            <span className="text-xs font-medium truncate">
              {hit.project}/{hit.issue}
            </span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              turn {hit.turnIndex}
            </span>
            {inOther && (
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                overlap
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
            {expanded ? hit.chunkText : truncate(hit.chunkText)}
          </p>
          {hit.chunkText.length > 220 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5 text-[11px] transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" /> less
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> more
                </>
              )}
            </button>
          )}
        </div>
        <span
          className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
          title={`Raw score: ${hit.score >= 1 ? hit.score.toFixed(2) : hit.score.toFixed(4)}`}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function ResultColumn({
  hits,
  otherHits,
  source,
  loading,
  queryUsed,
}: {
  hits: Hit[];
  otherHits: Hit[];
  source: "semantic" | "keyword";
  loading: boolean;
  queryUsed?: string;
}) {
  const otherIds = new Set(otherHits.map((h) => h.id));
  const isSemantic = source === "semantic";
  const maxScore = hits.length > 0 ? Math.max(...hits.map((h) => h.score)) : 0;

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-3 flex items-center gap-2">
        {isSemantic ? (
          <Brain className="size-4 text-violet-500" />
        ) : (
          <Type className="size-4 text-sky-500" />
        )}
        <h3 className="text-sm font-semibold">
          {isSemantic ? "Vector Search" : "Keyword Search"}
        </h3>
        {!loading && (
          <span className="text-muted-foreground text-xs">
            {hits.length} results
          </span>
        )}
      </div>
      {queryUsed && (
        <div className={cn(
          "mb-3 rounded-md border px-3 py-2",
          isSemantic
            ? "border-violet-500/20 bg-violet-500/5"
            : "border-sky-500/20 bg-sky-500/5"
        )}>
          <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Query sent
          </span>
          <p className="mt-0.5 font-mono text-xs break-all leading-relaxed">
            {queryUsed}
          </p>
        </div>
      )}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <Skeleton className="mb-2 h-3 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          : hits.map((hit, i) => (
              <HitCard
                key={hit.id}
                hit={hit}
                rank={i + 1}
                maxScore={maxScore}
                otherIds={otherIds}
                source={source}
              />
            ))}
        {!loading && hits.length === 0 && (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}

function OverlapBar({ meta }: { meta: CompareResult["meta"] }) {
  const total = meta.semanticCount + meta.keywordCount - meta.overlap;
  if (total === 0) return null;

  const semPct = ((meta.semanticOnly / total) * 100).toFixed(0);
  const overlapPct = ((meta.overlap / total) * 100).toFixed(0);
  const kwPct = ((meta.keywordOnly / total) * 100).toFixed(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-violet-500 font-medium">
          {meta.semanticOnly} vector-only
        </span>
        <span className="text-muted-foreground">
          {meta.overlap} overlap
        </span>
        <span className="text-sky-500 font-medium">
          {meta.keywordOnly} keyword-only
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full">
        <div
          className="bg-violet-500 transition-all"
          style={{ width: `${semPct}%` }}
        />
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: `${overlapPct}%` }}
        />
        <div
          className="bg-sky-500 transition-all"
          style={{ width: `${kwPct}%` }}
        />
      </div>
    </div>
  );
}

function ExplanationCard({ curated }: { curated: CuratedQuery }) {
  return (
    <Card className="border-primary/15 bg-primary/[0.02]">
      <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Lightbulb className="size-3.5" />
            Why vector search wins
          </div>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {curated.whyVectorWins}
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            Without vector search
          </div>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {curated.withoutVector}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuerySection({
  curated,
  index,
}: {
  curated: CuratedQuery;
  index: number;
}) {
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const runSearch = useCallback(async () => {
    if (result) {
      setOpen(!open);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/compare-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: curated.query, topK: 8 }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [curated.query, result, open]);

  return (
    <section className="space-y-3">
      <button
        onClick={runSearch}
        className="group flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className="text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold leading-snug">
              &ldquo;{curated.query}&rdquo;
            </h2>
            <Badge
              variant="outline"
              className={cn("text-[10px]", CATEGORY_STYLES[curated.category])}
            >
              {curated.category}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Click to run both searches and compare results side by side
          </p>
        </div>
        <span className="text-muted-foreground mt-1 shrink-0">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : open ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </span>
      </button>

      {open && (
        <div className="ml-10 space-y-3">
          <ExplanationCard curated={curated} />

          {result && <OverlapBar meta={result.meta} />}

          <div className="flex gap-4 flex-col lg:flex-row">
            <ResultColumn
              hits={result?.semantic ?? []}
              otherHits={result?.keyword ?? []}
              source="semantic"
              loading={loading}
              queryUsed={result?.queries?.semantic}
            />
            <ResultColumn
              hits={result?.keyword ?? []}
              otherHits={result?.semantic ?? []}
              source="keyword"
              loading={loading}
              queryUsed={result?.queries?.keyword}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function CustomQuerySection() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearchedQuery(query.trim());
    try {
      const res = await fetch("/api/compare-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), topK: 8 }),
      });
      setResult(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Try your own query</CardTitle>
        <CardDescription>
          Enter any natural-language query and compare what each search backend
          returns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. agent struggles with flaky tests"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : "Compare"}
          </Button>
        </form>

        {(loading || result) && (
          <div className="space-y-3">
            {searchedQuery && (
              <p className="text-muted-foreground text-xs">
                Results for &ldquo;{searchedQuery}&rdquo;
              </p>
            )}
            {result && <OverlapBar meta={result.meta} />}
            <div className="flex gap-4 flex-col lg:flex-row">
              <ResultColumn
                hits={result?.semantic ?? []}
                otherHits={result?.keyword ?? []}
                source="semantic"
                loading={loading}
                queryUsed={result?.queries?.semantic}
              />
              <ResultColumn
                hits={result?.keyword ?? []}
                otherHits={result?.semantic ?? []}
                source="keyword"
                loading={loading}
                queryUsed={result?.queries?.keyword}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComparePage() {
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/index/agent-traces-semantic">
              <ArrowLeft className="mr-1 size-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="size-5" />
              Vector Search vs. Keyword Search
            </h1>
            <p className="text-muted-foreground text-sm">
              10 curated queries showing where semantic understanding outperforms token matching
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-3 text-xs">
          <span className="text-muted-foreground font-medium">Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-violet-500" />
            Vector-only result
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-sky-500" />
            Keyword-only result
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-emerald-500" />
            Found by both
          </span>
          <span className="mx-2 text-muted-foreground">|</span>
          {Object.entries(CATEGORY_STYLES).map(([cat, cls]) => (
            <Badge key={cat} variant="outline" className={cn("text-[10px]", cls)}>
              {cat}
            </Badge>
          ))}
        </div>

        {/* Curated queries */}
        <div className="space-y-3">
          {CURATED_QUERIES.map((cq, i) => (
            <QuerySection key={cq.query} curated={cq} index={i} />
          ))}
        </div>

        {/* Custom query */}
        <CustomQuerySection />
      </main>
    </div>
  );
}
