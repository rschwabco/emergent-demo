"use client";

import { useState, useRef, useEffect } from "react";
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
import { Tag, X, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

interface TagBarProps {
  selectedCount: number;
  existingTags: string[];
  onApplyTag: (tag: string) => void;
  onClearSelection: () => void;
}

export function TagBar({
  selectedCount,
  existingTags,
  onApplyTag,
  onClearSelection,
}: TagBarProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (selectedCount === 0) return null;

  const handleSelect = (tag: string) => {
    onApplyTag(tag);
    setInputValue("");
    setOpen(false);
  };

  const handleCreateNew = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return;
    onApplyTag(trimmed);
    setInputValue("");
    setOpen(false);
  };

  const filtered = existingTags.filter((t) =>
    t.includes(inputValue.trim().toLowerCase())
  );
  const showCreate =
    inputValue.trim() &&
    !existingTags.includes(inputValue.trim().toLowerCase());

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-5 pointer-events-none">
      <div className="bg-background pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium tabular-nums">
          {selectedCount} selected
        </span>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="default" size="sm" className="gap-1.5">
              <Tag className="size-3.5" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="center" side="top">
            <Command>
              <CommandInput
                ref={inputRef}
                placeholder="Search or create tag..."
                value={inputValue}
                onValueChange={setInputValue}
              />
              <CommandList>
                <CommandEmpty className="py-2 text-center text-xs">
                  {inputValue.trim() ? (
                    <button
                      onClick={handleCreateNew}
                      className="text-primary flex w-full items-center justify-center gap-1.5 py-1 hover:underline"
                    >
                      <Plus className="size-3" />
                      Create &ldquo;{inputValue.trim().toLowerCase()}&rdquo;
                    </button>
                  ) : (
                    "Type to create a new tag"
                  )}
                </CommandEmpty>
                {filtered.length > 0 && (
                  <CommandGroup>
                    {filtered.map((tag) => (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => handleSelect(tag)}
                      >
                        <Tag className="text-muted-foreground size-3.5" />
                        {tag}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {showCreate && filtered.length > 0 && (
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateNew}>
                      <Plus className="size-3.5" />
                      Create &ldquo;{inputValue.trim().toLowerCase()}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground gap-1"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}

interface TagFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagFilter: (tag: string | null) => void;
  tagCounts: Record<string, number>;
  onDeleteTag?: (tag: string) => void;
}

export function TagFilter({
  tags,
  activeTag,
  onTagFilter,
  tagCounts,
  onDeleteTag,
}: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium mr-0.5 flex items-center gap-1">
        <Tag className="size-3" />
        Tags:
      </span>
      {tags.map((tag) => {
        const isActive = activeTag === tag;
        const count = tagCounts[tag] || 0;
        return (
          <span
            key={tag}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-all select-none",
              getTagColor(tag),
              isActive && "ring-2 ring-ring/40 shadow-sm"
            )}
            onClick={() => onTagFilter(isActive ? null : tag)}
          >
            <Tag className="size-3" />
            {tag}
            {count > 0 && (
              <span className="opacity-60 tabular-nums">({count})</span>
            )}
            {isActive && <Check className="size-3" />}
            {onDeleteTag && (
              <button
                className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTag(tag);
                }}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      {activeTag && (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground text-xs"
          onClick={() => onTagFilter(null)}
        >
          Clear filter
        </Button>
      )}
    </div>
  );
}
