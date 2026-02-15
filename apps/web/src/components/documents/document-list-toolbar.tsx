"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";

interface DocumentListToolbarProps {
  title: string;
  total: number;
  onSearch?: (query: string) => void;
  isSearchActive?: boolean;
}

export function DocumentListToolbar({ title, total, onSearch, isSearchActive }: DocumentListToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <h2 className="shrink-0 text-sm font-semibold">{title}</h2>
      <div className="flex items-center gap-2">
        {onSearch && <SearchBar onSearch={onSearch} />}
        {!isSearchActive && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                Date saved
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Date saved</DropdownMenuItem>
              <DropdownMenuItem>Date published</DropdownMenuItem>
              <DropdownMenuItem>Title A-Z</DropdownMenuItem>
              <DropdownMenuItem>Reading time</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
