"use client";

import { useEffect, useState } from "react";
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
  ChevronDown,
  Filter,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  PanelLeftOpen,
  PanelRightOpen,
  Search,
  Square,
  X,
} from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { useApp } from "@/contexts/app-context";
import type { DocumentType, ListDocumentsQuery } from "@focus-reader/shared";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === (selectedType ?? null))?.label ?? "All Types";
  const canChangeSort = !sortLocked && !!onSortByChange && !!onSortDirChange;
  const sortDirectionLabels = SORT_DIRECTION_LABELS[sortBy];
  const hasNonDefaultType = (selectedType ?? null) !== null;
  const hasNonDefaultSort = sortBy !== "saved_at" || sortDir !== "desc";
  const activeFilterCount = Number(hasNonDefaultType) + Number(hasNonDefaultSort);
  const bulkBusy = isBulkDeleting || isBulkUpdating;
  const visibleCount = total;
  const showVisibleCount = matchingCount > 0 && matchingCount !== visibleCount;
  const visibleScopeLabel = showVisibleCount ? `Visible (${visibleCount})` : "Visible";
  const matchingScopeLabel = `All matching (${matchingCount})`;

  useEffect(() => {
    if (!isMobile) setMobileSearchOpen(false);
  }, [isMobile]);

  const filterLabel = activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters";

  const filterMenu = (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Type</DropdownMenuLabel>
      {TYPE_OPTIONS.map((opt) => (
        <DropdownMenuCheckboxItem
          key={opt.label}
          checked={(selectedType ?? null) === opt.value}
          onCheckedChange={() => onTypeFilter?.(opt.value)}
          disabled={!onTypeFilter}
        >
          {opt.label}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuSeparator />
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
    </>
  );

  const canToggleMatching = !!onToggleSelectAllMatching && matchingCount > 0;
  const activateVisibleScope = () => {
    if (!onToggleSelectAllVisible) return;
    if (allMatchingSelected) {
      onToggleSelectAllVisible();
      return;
    }
    if (!allVisibleSelected) {
      onToggleSelectAllVisible();
    }
  };
  const activateMatchingScope = () => {
    if (!onToggleSelectAllMatching || allMatchingSelected) return;
    onToggleSelectAllMatching();
  };
  const hasBulkActions = !!onMoveSelectedToLater || !!onMoveSelectedToArchive || !!onDeleteSelected;

  const bulkActionsMenu = (
    <>
      {onMoveSelectedToLater && (
        <DropdownMenuItem
          onClick={onMoveSelectedToLater}
          disabled={selectedCount === 0 || bulkBusy}
        >
          Move selected to Later ({selectedCount})
        </DropdownMenuItem>
      )}
      {onMoveSelectedToArchive && (
        <DropdownMenuItem
          onClick={onMoveSelectedToArchive}
          disabled={selectedCount === 0 || bulkBusy}
        >
          Move selected to Archive ({selectedCount})
        </DropdownMenuItem>
      )}
      {onDeleteSelected && (
        <>
          {(onMoveSelectedToLater || onMoveSelectedToArchive) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={onDeleteSelected}
            disabled={selectedCount === 0 || bulkBusy}
            className="text-destructive"
          >
            Delete selected ({selectedCount})
          </DropdownMenuItem>
        </>
      )}
    </>
  );

  const viewToggle = onViewModeChange ? (
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
  ) : null;

  const filterControl = isMobile ? (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-7 text-muted-foreground"
          aria-label="Open filters"
        >
          <Filter className="size-3.5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl p-0">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-base">Filters</SheetTitle>
              <SheetDescription className="text-xs">Type and sort options</SheetDescription>
            </div>
            <SheetClose asChild>
              <Button variant="outline" size="sm" className="h-8">
                Done
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-5">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</h4>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.label}
                  variant={(selectedType ?? null) === opt.value ? "secondary" : "outline"}
                  size="sm"
                  className="justify-start"
                  onClick={() => onTypeFilter?.(opt.value)}
                  disabled={!onTypeFilter}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort by</h4>
            <div className="grid grid-cols-1 gap-2">
              {SORT_FIELDS.map((field) => (
                <Button
                  key={field.value}
                  variant={sortBy === field.value ? "secondary" : "outline"}
                  size="sm"
                  className="justify-start"
                  disabled={!canChangeSort}
                  onClick={() => onSortByChange?.(field.value)}
                >
                  {field.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order</h4>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={sortDir === "desc" ? "secondary" : "outline"}
                size="sm"
                className="justify-start"
                disabled={!canChangeSort}
                onClick={() => onSortDirChange?.("desc")}
              >
                {sortDirectionLabels.desc}
              </Button>
              <Button
                variant={sortDir === "asc" ? "secondary" : "outline"}
                size="sm"
                className="justify-start"
                disabled={!canChangeSort}
                onClick={() => onSortDirChange?.("asc")}
              >
                {sortDirectionLabels.asc}
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground">
          <Filter className="size-4" />
          {filterLabel}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px]">
        {filterMenu}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isBulkMode) {
    if (isMobile) {
      return (
        <>
          <div className="space-y-2 border-b px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {sidebarCollapsed && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
                    <PanelLeftOpen className="size-4" />
                  </Button>
                )}
                <span className="text-sm font-medium">{selectedCount} selected</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onToggleBulkMode}
                disabled={bulkBusy}
              >
                Cancel
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {onToggleSelectAllVisible && (
                <Button
                  variant={!allMatchingSelected ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={activateVisibleScope}
                  disabled={bulkBusy || total === 0}
                >
                  {visibleScopeLabel}
                </Button>
              )}
              {canToggleMatching && (
                <Button
                  variant={allMatchingSelected ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={activateMatchingScope}
                  disabled={bulkBusy}
                >
                  {matchingScopeLabel}
                </Button>
              )}
              {onClearSelection && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={onClearSelection}
                  disabled={bulkBusy || selectedCount === 0}
                >
                  None
                </Button>
              )}
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 p-2">
            <div className="mx-auto flex max-w-md items-center gap-2">
              {hasBulkActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 h-9"
                      disabled={selectedCount === 0 || bulkBusy}
                    >
                      Actions
                      <ChevronDown className="size-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-[240px]">
                    {bulkActionsMenu}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 sm:px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {sidebarCollapsed && (
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
          <span className="text-sm font-semibold">{selectedCount} {selectedLabel}</span>
          {onToggleSelectAllVisible && (
            <Button
              variant={!allMatchingSelected ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={activateVisibleScope}
              disabled={bulkBusy || total === 0}
            >
              {visibleScopeLabel}
            </Button>
          )}
          {canToggleMatching && (
            <Button
              variant={allMatchingSelected ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={activateMatchingScope}
              disabled={bulkBusy}
            >
              {matchingScopeLabel}
            </Button>
          )}
          {onClearSelection && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onClearSelection}
              disabled={bulkBusy || selectedCount === 0}
            >
              None
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {hasBulkActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  disabled={selectedCount === 0 || bulkBusy}
                >
                  Actions
                  <MoreHorizontal className="size-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px]">
                {bulkActionsMenu}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onToggleBulkMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={onToggleBulkMode}
              disabled={bulkBusy}
            >
              <X className="size-3.5 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b px-3 sm:px-4 py-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0 shrink-0">
          {sidebarCollapsed && (
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-sm font-semibold min-w-[84px] sm:min-w-[96px] max-w-[160px]"
          >
            <span className="truncate">{title}</span>
            <ChevronDown className="size-3 shrink-0" />
          </Button>
          {onToggleBulkMode && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Select documents"
              onClick={onToggleBulkMode}
              disabled={bulkBusy}
            >
              <Square className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {isMobile ? (
            onSearch ? (
              <Button
                variant={mobileSearchOpen ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                onClick={() => setMobileSearchOpen((v) => !v)}
              >
                <Search className="size-4" />
              </Button>
            ) : null
          ) : (
            onSearch && (
              <div className="min-w-[140px] w-[180px] md:w-[220px] lg:w-[260px] xl:w-[320px] max-w-[34vw]">
                <SearchBar onSearch={onSearch} />
              </div>
            )
          )}
          {!isSearchActive && filterControl}
          {viewToggle}
          {!isMobile && !rightPanelVisible && (
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
              <PanelRightOpen className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {isMobile && onSearch && mobileSearchOpen && (
        <div className={cn("w-full", !isSearchActive && "pt-0.5")}>
          <SearchBar onSearch={onSearch} />
        </div>
      )}

      {isMobile && isSearchActive && !mobileSearchOpen && (
        <div className="text-xs text-muted-foreground">
          Search active
        </div>
      )}
    </div>
  );
}
