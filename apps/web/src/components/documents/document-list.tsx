"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ListDocumentsQuery, DocumentLocation, DocumentType } from "@focus-reader/shared";
import { useDocuments } from "@/hooks/use-documents";
import { useSearch } from "@/hooks/use-search";
import { useApp } from "@/contexts/app-context";
import { DocumentListItem } from "./document-list-item";
import { DocumentListToolbar } from "./document-list-toolbar";
import type { ViewMode } from "./document-list-toolbar";
import { DocumentGrid } from "./document-grid";
import { EmptyState } from "./empty-state";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

const DEFAULT_SORT_BY: NonNullable<ListDocumentsQuery["sortBy"]> = "saved_at";
const DEFAULT_SORT_DIR: NonNullable<ListDocumentsQuery["sortDir"]> = "desc";
const ALLOWED_SORT_FIELDS = new Set<NonNullable<ListDocumentsQuery["sortBy"]>>([
  "saved_at",
  "published_at",
  "title",
  "reading_time_minutes",
]);
const ALLOWED_SORT_DIRECTIONS = new Set<NonNullable<ListDocumentsQuery["sortDir"]>>([
  "asc",
  "desc",
]);

function parseStoredSortBy(value: string | null): NonNullable<ListDocumentsQuery["sortBy"]> {
  if (value && ALLOWED_SORT_FIELDS.has(value as NonNullable<ListDocumentsQuery["sortBy"]>)) {
    return value as NonNullable<ListDocumentsQuery["sortBy"]>;
  }
  return DEFAULT_SORT_BY;
}

function parseStoredSortDir(value: string | null): NonNullable<ListDocumentsQuery["sortDir"]> {
  if (value && ALLOWED_SORT_DIRECTIONS.has(value as NonNullable<ListDocumentsQuery["sortDir"]>)) {
    return value as NonNullable<ListDocumentsQuery["sortDir"]>;
  }
  return DEFAULT_SORT_DIR;
}

interface DocumentListProps {
  location?: DocumentLocation;
  tagId?: string;
  subscriptionId?: string;
  feedId?: string;
  isStarred?: boolean;
  title: string;
  type?: DocumentType;
  status?: "read" | "unread";
  savedAfter?: string;
  savedBefore?: string;
  sortBy?: ListDocumentsQuery["sortBy"];
  sortDir?: ListDocumentsQuery["sortDir"];
}

export function DocumentList({
  location,
  tagId,
  subscriptionId,
  feedId,
  isStarred,
  title,
  type: typeProp,
  status,
  savedAfter,
  savedBefore,
  sortBy: sortByProp,
  sortDir: sortDirProp,
}: DocumentListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSelectedId = searchParams.get("doc");
  const {
    selectedDocumentId,
    setSelectedDocumentId,
    hoveredDocumentId,
    setHoveredDocumentId,
    setDocumentIds,
    setCurrentDocumentIndex,
    registerListMutate,
  } = useApp();
  const selectedId = urlSelectedId || selectedDocumentId;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("focus-view-mode") as ViewMode) || "list";
    }
    return "list";
  });

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("focus-view-mode", mode);
  }, []);

  const [sortBy, setSortBy] = useState<ListDocumentsQuery["sortBy"]>(() => {
    if (typeof window !== "undefined") {
      return parseStoredSortBy(localStorage.getItem("focus-sort-by"));
    }
    return DEFAULT_SORT_BY;
  });

  const [sortDir, setSortDir] = useState<ListDocumentsQuery["sortDir"]>(() => {
    if (typeof window !== "undefined") {
      return parseStoredSortDir(localStorage.getItem("focus-sort-dir"));
    }
    return DEFAULT_SORT_DIR;
  });

  const handleSortByChange = useCallback((field: NonNullable<ListDocumentsQuery["sortBy"]>) => {
    setSortBy(field);
    if (typeof window !== "undefined") {
      localStorage.setItem("focus-sort-by", field);
    }
  }, []);

  const handleSortDirChange = useCallback((dir: NonNullable<ListDocumentsQuery["sortDir"]>) => {
    setSortDir(dir);
    if (typeof window !== "undefined") {
      localStorage.setItem("focus-sort-dir", dir);
    }
  }, []);

  const query: ListDocumentsQuery = {
    location,
    tagId,
    subscriptionId,
    feedId,
    isStarred,
    type: typeFilter || typeProp || undefined,
    status,
    savedAfter,
    savedBefore,
    sortBy: sortByProp ?? sortBy ?? DEFAULT_SORT_BY,
    sortDir: sortDirProp ?? sortDir ?? DEFAULT_SORT_DIR,
  };

  const sortLocked = sortByProp !== undefined || sortDirProp !== undefined;
  const effectiveSortBy = query.sortBy ?? DEFAULT_SORT_BY;
  const effectiveSortDir = query.sortDir ?? DEFAULT_SORT_DIR;

  const { documents, total, isLoading, isLoadingMore, hasMore, loadMore, mutate } =
    useDocuments(query);

  // Register list mutate so app-shell hotkeys can trigger revalidation
  useEffect(() => {
    registerListMutate(() => mutate());
  }, [registerListMutate, mutate]);

  const {
    results: searchResults,
    total: searchTotal,
    isLoading: searchIsLoading,
  } = useSearch(searchQuery, { location, tagId });

  const isSearchActive = searchQuery.trim().length >= 2;

  // Infinite scroll observer
  useEffect(() => {
    if (isSearchActive) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, isSearchActive]);

  // Determine which data to display
  const displayDocuments = useMemo(
    () => (isSearchActive ? searchResults : documents),
    [isSearchActive, searchResults, documents]
  );
  const displayDocIds = useMemo(
    () => displayDocuments.map((doc) => doc.id),
    [displayDocuments]
  );
  const allVisibleSelected = useMemo(
    () => displayDocIds.length > 0 && displayDocIds.every((id) => selectedBulkIds.has(id)),
    [displayDocIds, selectedBulkIds]
  );
  // Sync document IDs to app context for keyboard navigation
  useEffect(() => {
    setDocumentIds(displayDocuments.map((d) => d.id));
  }, [displayDocuments, setDocumentIds]);

  // Keep bulk selections only for currently visible list items.
  useEffect(() => {
    const visible = new Set(displayDocIds);
    setSelectedBulkIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [displayDocIds]);

  // Avoid carrying selection mode between different routes/views.
  useEffect(() => {
    setIsBulkMode(false);
    setSelectedBulkIds(new Set());
  }, [pathname]);

  // Ensure list view always has a valid active selection when not in reading mode.
  useEffect(() => {
    if (displayDocuments.length === 0) {
      setCurrentDocumentIndex(-1);
      setHoveredDocumentId(null);
      if (!urlSelectedId) {
        setSelectedDocumentId(null);
      }
      return;
    }

    const activeId = urlSelectedId || selectedDocumentId;
    const selectedIndex = activeId
      ? displayDocuments.findIndex((d) => d.id === activeId)
      : -1;

    if (selectedIndex >= 0) {
      setCurrentDocumentIndex(selectedIndex);
      return;
    }

    if (!urlSelectedId) {
      setSelectedDocumentId(displayDocuments[0].id);
      setCurrentDocumentIndex(0);
      if (hoveredDocumentId && hoveredDocumentId !== displayDocuments[0].id) {
        setHoveredDocumentId(null);
      }
    } else {
      setCurrentDocumentIndex(-1);
    }
  }, [
    displayDocuments,
    hoveredDocumentId,
    selectedDocumentId,
    setCurrentDocumentIndex,
    setHoveredDocumentId,
    setSelectedDocumentId,
    urlSelectedId,
  ]);

  const selectDocument = useCallback(
    (id: string) => {
      setSelectedDocumentId(id);
      const idx = displayDocuments.findIndex((d) => d.id === id);
      setCurrentDocumentIndex(idx);
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, setSelectedDocumentId, displayDocuments, setCurrentDocumentIndex]
  );

  const openDocument = useCallback(
    (id: string) => {
      selectDocument(id);
    },
    [selectDocument]
  );

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const toggleBulkSelect = useCallback((id: string) => {
    setSelectedBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearBulkSelection = useCallback(() => {
    setSelectedBulkIds(new Set());
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedBulkIds((prev) => {
      const next = new Set(prev);
      const everySelected = displayDocIds.length > 0 && displayDocIds.every((id) => next.has(id));
      if (everySelected) {
        for (const id of displayDocIds) next.delete(id);
      } else {
        for (const id of displayDocIds) next.add(id);
      }
      return next;
    });
  }, [displayDocIds]);

  const toggleBulkMode = useCallback(() => {
    setIsBulkMode((prev) => !prev);
    setSelectedBulkIds(new Set());
  }, []);

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedBulkIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected documents? This cannot be undone.`);
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const result = await apiFetch<{ deletedCount: number }>("/api/documents/bulk-delete", {
        method: "POST",
        body: JSON.stringify({
          scope: "selected",
          ids,
        }),
      });
      toast(`${result.deletedCount} documents deleted`);
      setSelectedBulkIds(new Set());
      setHoveredDocumentId(null);
      await mutate();
    } catch {
      toast.error("Failed to delete selected documents");
    } finally {
      setIsBulkDeleting(false);
    }
  }, [mutate, selectedBulkIds, setHoveredDocumentId]);

  const displayTotal = isSearchActive ? searchTotal : total;
  const displayIsLoading = isSearchActive ? searchIsLoading : isLoading;

  const toolbarProps = {
    title,
    total: displayTotal,
    onSearch: handleSearch,
    isSearchActive,
    onTypeFilter: setTypeFilter,
    selectedType: typeFilter,
    viewMode,
    onViewModeChange: handleViewModeChange,
    sortBy: effectiveSortBy,
    sortDir: effectiveSortDir,
    onSortByChange: sortLocked ? undefined : handleSortByChange,
    onSortDirChange: sortLocked ? undefined : handleSortDirChange,
    sortLocked,
    isBulkMode,
    selectedCount: selectedBulkIds.size,
    allVisibleSelected,
    isBulkDeleting,
    onToggleBulkMode: toggleBulkMode,
    onToggleSelectAllVisible: toggleSelectAllVisible,
    onClearSelection: clearBulkSelection,
    onDeleteSelected: deleteSelected,
  };

  if (displayIsLoading && displayDocuments.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <DocumentListToolbar {...toolbarProps} total={0} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3 border-b">
            <Skeleton className="w-20 h-14 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displayDocuments.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <DocumentListToolbar {...toolbarProps} total={0} />
        {isSearchActive ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No results for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <EmptyState location={location} isStarred={isStarred} hasTag={!!tagId} />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <DocumentListToolbar {...toolbarProps} />
      <div className="flex-1 overflow-y-auto">
        {viewMode === "grid" ? (
          <DocumentGrid
            documents={displayDocuments}
            selectedId={selectedId}
            showBulkSelect={isBulkMode}
            selectedBulkIds={selectedBulkIds}
            onSelect={(id) => (isBulkMode ? toggleBulkSelect(id) : selectDocument(id))}
            onOpen={(id) => {
              if (!isBulkMode) openDocument(id);
            }}
            onHover={setHoveredDocumentId}
            onToggleBulkSelect={toggleBulkSelect}
            onMutate={() => mutate()}
          />
        ) : (
          displayDocuments.map((doc) => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              isSelected={doc.id === selectedId}
              showBulkSelect={isBulkMode}
              isBulkSelected={selectedBulkIds.has(doc.id)}
              onClick={() => (isBulkMode ? toggleBulkSelect(doc.id) : selectDocument(doc.id))}
              onDoubleClick={() => {
                if (!isBulkMode) openDocument(doc.id);
              }}
              onMouseEnter={() => setHoveredDocumentId(doc.id)}
              onMouseLeave={() => setHoveredDocumentId(null)}
              onToggleBulkSelect={() => toggleBulkSelect(doc.id)}
              onMutate={() => mutate()}
              snippet={isSearchActive ? (doc as any).snippet : undefined}
            />
          ))
        )}
        {/* Infinite scroll sentinel (only for non-search) */}
        {!isSearchActive && (
          <>
            <div ref={sentinelRef} className="h-4" />
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t px-4 py-1.5 text-xs text-muted-foreground text-right">
        Count: {displayTotal}
      </div>
    </div>
  );
}
