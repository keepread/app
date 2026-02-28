"use client";

import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  ChevronDown,
  PanelLeftOpen,
  PanelRightOpen,
  LayoutList,
  LayoutGrid,
  SlidersHorizontal,
  SquareCheck,
  SquareMinus,
  Square,
  Search,
  X,
} from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { useApp } from "@/contexts/app-context";
import { cn } from "@/lib/utils";
import type { DocumentType, ListDocumentsQuery } from "@focus-reader/shared";
import { useIsMobile } from "@/hooks/use-mobile";

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
  saved_at: { desc: "Recent → Old", asc: "Old → Recent" },
  published_at: { desc: "Recent → Old", asc: "Old → Recent" },
  title: { desc: "Z → A", asc: "A → Z" },
  reading_time_minutes: { desc: "Long → Short", asc: "Short → Long" },
};

const DEFAULT_SORT_BY: SortField = "saved_at";
const DEFAULT_SORT_DIR: SortDirection = "desc";

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
  selectedLabel?: string;
  allVisibleSelected?: boolean;
  allMatchingSelected?: boolean;
  matchingCount?: number;
  isBulkDeleting?: boolean;
  isBulkUpdating?: boolean;
  onToggleBulkMode?: () => void;
  onToggleSelectAllVisible?: () => void;
  onToggleSelectAllMatching?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  onMoveSelectedToLater?: () => void;
  onMoveSelectedToArchive?: () => void;
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
  selectedLabel = "selected",
  allVisibleSelected = false,
  allMatchingSelected = false,
  matchingCount = 0,
  isBulkDeleting = false,
  isBulkUpdating = false,
  onToggleBulkMode,
  onToggleSelectAllVisible,
  onToggleSelectAllMatching,
  onClearSelection,
  onDeleteSelected,
  onMoveSelectedToLater,
  onMoveSelectedToArchive,
}: DocumentListToolbarProps) {
  const { sidebarCollapsed, toggleSidebar, rightPanelVisible, toggleRightPanel } = useApp();
  const isMobile = useIsMobile();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const canChangeSort = !sortLocked && !!onSortByChange && !!onSortDirChange;
  const sortDirectionLabels = SORT_DIRECTION_LABELS[sortBy];

  const hasActiveFilter =
    (selectedType ?? null) !== null ||
    (!sortLocked && (sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR));

  const showFilterButton = !isSearchActive && (!!onTypeFilter || canChangeSort);

  // Checkbox icon reflects current selection state
  const CheckboxIcon = (allMatchingSelected || allVisibleSelected)
    ? SquareCheck
    : selectedCount > 0
      ? SquareMinus
      : Square;

  // Gmail-style [☐▾] scope dropdown — shown in both normal and bulk mode
  const scopeDropdown = onToggleBulkMode ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-0.5 px-1.5 focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isBulkDeleting || isBulkUpdating}
        >
          <CheckboxIcon className="size-4" />
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {!isBulkMode ? (
          // Normal mode: entering bulk with a specific scope
          <>
            {onToggleSelectAllVisible && (
              <DropdownMenuItem onClick={() => { onToggleBulkMode(); onToggleSelectAllVisible(); }}>
                Select All
              </DropdownMenuItem>
            )}
            {onToggleSelectAllMatching && matchingCount > 0 && (
              <DropdownMenuItem onClick={() => { onToggleBulkMode(); onToggleSelectAllMatching(); }}>
                Select All Matching ({matchingCount})
              </DropdownMenuItem>
            )}
          </>
        ) : (
          // Bulk mode: explicit scope options (no toggles)
          <>
            {onToggleSelectAllVisible && !allVisibleSelected && (
              <DropdownMenuItem
                onClick={onToggleSelectAllVisible}
                disabled={isBulkDeleting || isBulkUpdating || total === 0}
              >
                Select All
              </DropdownMenuItem>
            )}
            {onToggleSelectAllMatching && matchingCount > 0 && (
              <DropdownMenuItem
                onClick={onToggleSelectAllMatching}
                disabled={isBulkDeleting || isBulkUpdating}
              >
                {allMatchingSelected ? "Visible Only" : `All Matching (${matchingCount})`}
              </DropdownMenuItem>
            )}
            {onClearSelection && selectedCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onClearSelection}
                  disabled={isBulkDeleting || isBulkUpdating}
                >
                  None
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="flex items-center justify-between gap-2 border-b px-3 sm:px-4 py-2">

      {/* ── Left cluster ── */}
      {isBulkMode ? (
        // Bulk mode: Done | count | [☐▾] | separator | Archive Later Delete (desktop)
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs shrink-0"
            onClick={onToggleBulkMode}
            disabled={isBulkDeleting || isBulkUpdating}
          >
            <X className="size-3" />
            Done
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {selectedCount} {selectedLabel}
          </span>
          {scopeDropdown}
          {/* Separator + action buttons — desktop only, mobile uses BulkActionBar */}
          <div className="hidden sm:flex items-center gap-1">
            <div className="w-px h-4 bg-border mx-0.5" />
            {onMoveSelectedToArchive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onMoveSelectedToArchive}
                disabled={selectedCount === 0 || isBulkDeleting || isBulkUpdating}
              >
                Archive
              </Button>
            )}
            {onMoveSelectedToLater && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onMoveSelectedToLater}
                disabled={selectedCount === 0 || isBulkDeleting || isBulkUpdating}
              >
                Later
              </Button>
            )}
            {onDeleteSelected && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={onDeleteSelected}
                disabled={selectedCount === 0 || isBulkDeleting || isBulkUpdating}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Normal mode: sidebar toggle + title + [☐▾]
        <div className="flex items-center gap-1 min-w-0">
          {sidebarCollapsed && (
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
          <span className="px-2 text-sm font-semibold">{title}</span>
          {scopeDropdown}
        </div>
      )}

      {/* ── Right cluster — hidden in bulk mode ── */}
      {!isBulkMode && (
        isMobile && searchExpanded ? (
          // Mobile search expanded: full-width input takes over
          <div className="flex flex-1 items-center min-w-0">
            <SearchBar
              onSearch={onSearch!}
              compact
              expanded
              onExpandedChange={setSearchExpanded}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile: search icon button */}
            {onSearch && isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSearchExpanded(true)}
              >
                <Search className="size-4" />
              </Button>
            )}

            {/* Desktop: always-visible search input */}
            {onSearch && !isMobile && (
              <SearchBar onSearch={onSearch} />
            )}

            {/* Filter button — mobile: bottom sheet, desktop: dropdown */}
            {showFilterButton && (
              isMobile ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-7 relative", hasActiveFilter && "text-primary")}
                    onClick={() => setFilterSheetOpen(true)}
                  >
                    <SlidersHorizontal className="size-4" />
                    {hasActiveFilter && (
                      <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                  <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="px-0">
                      <SheetHeader className="px-4 pb-2">
                        <SheetTitle className="text-base">Filter & Sort</SheetTitle>
                      </SheetHeader>
                      <div className="px-2 pb-2">
                        {onTypeFilter && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Type</p>
                            {TYPE_OPTIONS.map((opt) => (
                              <button
                                key={opt.label}
                                className={cn(
                                  "w-full text-left px-2 py-2 text-sm rounded-md hover:bg-accent",
                                  (selectedType ?? null) === opt.value && "font-medium text-primary"
                                )}
                                onClick={() => {
                                  onTypeFilter(opt.value);
                                  setFilterSheetOpen(false);
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                            <div className="my-2 border-t" />
                          </>
                        )}
                        <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Sort by</p>
                        {SORT_FIELDS.map((field) => (
                          <button
                            key={field.value}
                            className={cn(
                              "w-full text-left px-2 py-2 text-sm rounded-md hover:bg-accent",
                              !canChangeSort && "opacity-50 pointer-events-none",
                              sortBy === field.value && "font-medium text-primary"
                            )}
                            onClick={() => onSortByChange?.(field.value)}
                          >
                            {field.label}
                          </button>
                        ))}
                        <div className="my-2 border-t" />
                        <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Order</p>
                        {(["desc", "asc"] as SortDirection[]).map((dir) => (
                          <button
                            key={dir}
                            className={cn(
                              "w-full text-left px-2 py-2 text-sm rounded-md hover:bg-accent",
                              !canChangeSort && "opacity-50 pointer-events-none",
                              sortDir === dir && "font-medium text-primary"
                            )}
                            onClick={() => onSortDirChange?.(dir)}
                          >
                            {sortDirectionLabels[dir]}
                          </button>
                        ))}
                      </div>
                      <div className="px-4 pt-2 pb-4">
                        <SheetClose asChild>
                          <Button className="w-full" variant="outline">Done</Button>
                        </SheetClose>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("size-7 relative", hasActiveFilter && "text-primary")}
                    >
                      <SlidersHorizontal className="size-4" />
                      {hasActiveFilter && (
                        <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {onTypeFilter && (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Type</DropdownMenuLabel>
                        {TYPE_OPTIONS.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt.label}
                            checked={(selectedType ?? null) === opt.value}
                            onCheckedChange={() => onTypeFilter(opt.value)}
                          >
                            {opt.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    )}
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
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Order</DropdownMenuLabel>
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
              )
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
            {!isMobile && !rightPanelVisible && (
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
                <PanelRightOpen className="size-4" />
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
