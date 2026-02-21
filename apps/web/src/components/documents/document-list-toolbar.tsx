"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Filter, PanelLeftOpen, PanelRightOpen, LayoutList, LayoutGrid } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { useApp } from "@/contexts/app-context";
import type { DocumentType } from "@focus-reader/shared";

const TYPE_OPTIONS: { label: string; value: DocumentType | null }[] = [
  { label: "All Types", value: null },
  { label: "Articles", value: "article" },
  { label: "Emails", value: "email" },
  { label: "RSS", value: "rss" },
  { label: "Bookmarks", value: "bookmark" },
  { label: "PDFs", value: "pdf" },
];

export type ViewMode = "list" | "grid";

interface DocumentListToolbarProps {
  title: string;
  total: number;
  onSearch?: (query: string) => void;
  isSearchActive?: boolean;
  onTypeFilter?: (type: DocumentType | null) => void;
  selectedType?: DocumentType | null;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function DocumentListToolbar({ title, total, onSearch, isSearchActive, onTypeFilter, selectedType, viewMode, onViewModeChange }: DocumentListToolbarProps) {
  const { sidebarCollapsed, toggleSidebar, rightPanelVisible, toggleRightPanel } = useApp();
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === (selectedType ?? null))?.label ?? "All Types";

  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-1 shrink-0">
        {sidebarCollapsed && (
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {onSearch && <SearchBar onSearch={onSearch} />}
        {!isSearchActive && onTypeFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                <Filter className="size-3" />
                {typeLabel}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TYPE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.label}
                  onClick={() => onTypeFilter(opt.value)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
        {onViewModeChange && (
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-7 rounded-r-none"
              onClick={() => onViewModeChange("list")}
            >
              <LayoutList className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="size-7 rounded-l-none"
              onClick={() => onViewModeChange("grid")}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
          </div>
        )}
        {!rightPanelVisible && (
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
            <PanelRightOpen className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
