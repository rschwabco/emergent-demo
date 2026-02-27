"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

const SUGGESTED_QUERIES = [
  "agent realizes its fix broke other tests and changes approach",
  "reading error traceback to diagnose the issue",
  "debugging a Django migration error",
  "agent searches the codebase before making changes",
  "step by step reasoning to fix a failing test",
  "handling edge cases in parsing",
];

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSuggestedQuery?: (query: string) => void;
  loading?: boolean;
  showSuggestions?: boolean;
}

export function SearchBar({
  query,
  onQueryChange,
  onSearch,
  onSuggestedQuery,
  loading,
  showSuggestions = true,
}: SearchBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="flex w-full gap-2"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search agent traces... e.g. 'debugging a Django migration' or 'IntegrityError'"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : "Search"}
        </Button>
      </form>
      {showSuggestions && onSuggestedQuery && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground/60 self-center text-[11px] italic">
            Try:
          </span>
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              type="button"
              disabled={loading}
              onClick={() => onSuggestedQuery(sq)}
              className="text-muted-foreground/70 hover:text-foreground hover:bg-accent rounded-full bg-muted/50 px-2.5 py-0.5 text-[11px] transition-colors disabled:opacity-50"
            >
              {sq}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
