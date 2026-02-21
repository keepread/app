"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Filter, PanelLeftOpen, PanelRightOpen, LayoutList, LayoutGrid } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { useApp } from "@/contexts/app-context";
import type { DocumentType, ListDocumentsQuery } from "@focus-reader/shared";

const TYPE_OPTIONS: { label: string; value: DocumentType | null }[] = [
  { label: "All Types", value: null },
  { label: "Articles", value: "article" },
  { label: "Emails", value: "email" },
  { label: "RSS", value: "rss" },
  { label: "Bookmarks", value: "bookmark" },
  { label: "PDFs", value: "pdf" },
];

type SortField = NonNullable<ListDocumentsQuery["sortBy"]>;
type SortDirection = NonNullable<ListDocumentsQuery["sortDir"]>;

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "saved_at", label: "Date saved" },
  { value: "published_at", label: "Date published" },
  { value: "title", label: "Title" },
  { value: "reading_time_minutes", label: "Reading time" },
];

const SORT_DIRECTION_LABELS: Record<SortField, Record<SortDirection, string>> = {
  saved_at: {
    desc: "Recent → Old",
    asc: "Old → Recent",
  },
  published_at: {
    desc: "Recent → Old",
    asc: "Old → Recent",
  },
  title: {
    desc: "Z → A",
    asc: "A → Z",
  },
  reading_time_minutes: {
    desc: "Long → Short",
    asc: "Short → Long",
  },
};

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
  sortBy?: ListDocumentsQuery["sortBy"];
  sortDir?: ListDocumentsQuery["sortDir"];
  onSortByChange?: (field: NonNullable<ListDocumentsQuery["sortBy"]>) => void;
  onSortDirChange?: (dir: NonNullable<ListDocumentsQuery["sortDir"]>) => void;
  sortLocked?: boolean;
  isBulkMode?: boolean;
  selectedCount?: number;
  allVisibleSelected?: boolean;
  isBulkDeleting?: boolean;
  onToggleBulkMode?: () => void;
  onToggleSelectAllVisible?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
}

export function DocumentListToolbar({
  title,
  total,
  onSearch,
  isSearchActive,
  onTypeFilter,
  selectedType,
  viewMode,
  onViewModeChange,
  sortBy = "saved_at",
  sortDir = "desc",
  onSortByChange,
  onSortDirChange,
  sortLocked = false,
  isBulkMode = false,
  selectedCount = 0,
  allVisibleSelected = false,
  isBulkDeleting = false,
  onToggleBulkMode,
  onToggleSelectAllVisible,
  onClearSelection,
  onDeleteSelected,
}: DocumentListToolbarProps) {
  const { sidebarCollapsed, toggleSidebar, rightPanelVisible, toggleRightPanel } = useApp();
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === (selectedType ?? null))?.label ?? "All Types";
  const canChangeSort = !sortLocked && !!onSortByChange && !!onSortDirChange;
  const sortDirectionLabels = SORT_DIRECTION_LABELS[sortBy];

  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-1 shrink-0">
        {sidebarCollapsed && (
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-sm font-semibold">
              {title}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {onToggleBulkMode && (
              <DropdownMenuItem onClick={onToggleBulkMode}>
                {isBulkMode ? "Exit selection mode" : "Select documents"}
              </DropdownMenuItem>
            )}
            {onDeleteSelected && isBulkMode && (
              <DropdownMenuItem
                onClick={onDeleteSelected}
                disabled={selectedCount === 0 || isBulkDeleting}
                className="text-destructive"
              >
                Delete selected ({selectedCount})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {isBulkMode && onToggleSelectAllVisible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onToggleSelectAllVisible}
            disabled={isBulkDeleting || total === 0}
          >
            {allVisibleSelected ? "Clear all" : "Select all"}
          </Button>
        )}
        {isBulkMode && (
          <>
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
            {onClearSelection && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onClearSelection}
                disabled={isBulkDeleting || selectedCount === 0}
              >
                Clear
              </Button>
            )}
            {onToggleBulkMode && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onToggleBulkMode}
                disabled={isBulkDeleting}
              >
                <Check className="size-3" />
                Done
              </Button>
            )}
          </>
        )}
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
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                disabled={!canChangeSort}
              >
                {SORT_FIELDS.find((f) => f.value === sortBy)?.label || "Sort"}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Sort by</DropdownMenuLabel>
              {SORT_FIELDS.map((field) => (
                <DropdownMenuCheckboxItem
                  key={field.value}
                  checked={sortBy === field.value}
                  disabled={!canChangeSort}
                  onCheckedChange={() => onSortByChange?.(field.value)}
                >
                  {field.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Order by</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={sortDir === "desc"}
                disabled={!canChangeSort}
                onCheckedChange={() => onSortDirChange?.("desc")}
              >
                {sortDirectionLabels.desc}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortDir === "asc"}
                disabled={!canChangeSort}
                onCheckedChange={() => onSortDirChange?.("asc")}
              >
                {sortDirectionLabels.asc}
              </DropdownMenuCheckboxItem>
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
