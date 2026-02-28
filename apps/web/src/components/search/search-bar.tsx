"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  /** When true, renders as a Search icon button that expands to a full input on tap (mobile). */
  compact?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function SearchBar({ onSearch, compact, expanded, onExpandedChange }: SearchBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const emitSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(query);
      }, 300);
    },
    [onSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    emitSearch(next);
  };

  const handleClear = () => {
    setValue("");
    onSearch("");
    inputRef.current?.focus();
  };

  const handleCollapse = () => {
    setValue("");
    onSearch("");
    onExpandedChange?.(false);
  };

  // Auto-focus when expanding
  useEffect(() => {
    if (compact && expanded) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [compact, expanded]);

  // "/" keyboard shortcut to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Compact mode: icon-only until expanded
  if (compact && !expanded) {
    return (
      <Button variant="ghost" size="icon" className="size-7" onClick={() => onExpandedChange?.(true)}>
        <Search className="size-4" />
      </Button>
    );
  }

  // Compact mode: expanded full-width input
  if (compact && expanded) {
    return (
      <div className="relative flex flex-1 items-center">
        <Search className="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search…"
          value={value}
          onChange={handleChange}
          className="h-8 pl-8 pr-8 text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 h-8 w-8 p-0"
          onClick={handleCollapse}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  // Default: always-visible full input (desktop)
  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Press / to search"
        value={value}
        onChange={handleChange}
        className="h-8 pl-8 pr-8 text-sm"
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 h-8 w-8 p-0"
          onClick={handleClear}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
