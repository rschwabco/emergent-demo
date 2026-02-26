"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Type } from "lucide-react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  textQuery: string;
  onTextQueryChange: (query: string) => void;
  onSearch: () => void;
  loading?: boolean;
}

export function SearchBar({
  query,
  onQueryChange,
  textQuery,
  onTextQueryChange,
  onSearch,
  loading,
}: SearchBarProps) {
  return (
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
          placeholder="Semantic search… e.g. 'debugging a Django migration'"
          className="pl-9"
        />
      </div>
      <div className="relative flex-1">
        <Type className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={textQuery}
          onChange={(e) => onTextQueryChange(e.target.value)}
          placeholder="Text search… e.g. 'django install'"
          className="pl-9"
        />
      </div>
      <Button
        type="submit"
        disabled={loading || (!query.trim() && !textQuery.trim())}
      >
        {loading ? <Loader2 className="animate-spin" /> : "Search"}
      </Button>
    </form>
  );
}
