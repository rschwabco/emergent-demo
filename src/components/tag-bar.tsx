"use client";

import { useState, useRef, useEffect } from "react";
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
import { Tag, X, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs mr-1">Tags:</span>
      {tags.map((tag) => {
        const isActive = activeTag === tag;
        const count = tagCounts[tag] || 0;
        return (
          <Badge
            key={tag}
            variant={isActive ? "default" : "outline"}
            className={cn(
              "cursor-pointer gap-1 transition-colors select-none",
              isActive && "ring-2 ring-ring/30"
            )}
            onClick={() => onTagFilter(isActive ? null : tag)}
          >
            {tag}
            {count > 0 && (
              <span className="text-[10px] opacity-70">({count})</span>
            )}
            {isActive && <Check className="size-3" />}
            {onDeleteTag && (
              <button
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTag(tag);
                }}
              >
                <X className="size-2.5" />
              </button>
            )}
          </Badge>
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
