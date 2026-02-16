"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ListDocumentsQuery, DocumentLocation, DocumentType } from "@focus-reader/shared";
import { useDocuments } from "@/hooks/use-documents";
import { useSearch } from "@/hooks/use-search";
import { useApp } from "@/contexts/app-context";
import { DocumentListItem } from "./document-list-item";
import { DocumentListToolbar } from "./document-list-toolbar";
import { EmptyState } from "./empty-state";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { selectedDocumentId, setSelectedDocumentId, setDocumentIds, setCurrentDocumentIndex, registerListMutate } = useApp();
  const selectedId = urlSelectedId || selectedDocumentId;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | null>(null);

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
    sortBy: sortByProp ?? "saved_at",
    sortDir: sortDirProp ?? "desc",
  };

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

  // Sync document IDs to app context for keyboard navigation
  useEffect(() => {
    setDocumentIds(displayDocuments.map((d) => d.id));
  }, [displayDocuments, setDocumentIds]);

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
  const displayTotal = isSearchActive ? searchTotal : total;
  const displayIsLoading = isSearchActive ? searchIsLoading : isLoading;

  if (displayIsLoading && displayDocuments.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <DocumentListToolbar
          title={title}
          total={0}
          onSearch={handleSearch}
          isSearchActive={isSearchActive}
          onTypeFilter={setTypeFilter}
          selectedType={typeFilter}
        />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3 border-b">
            <Skeleton className="size-14 rounded" />
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
        <DocumentListToolbar
          title={title}
          total={0}
          onSearch={handleSearch}
          isSearchActive={isSearchActive}
          onTypeFilter={setTypeFilter}
          selectedType={typeFilter}
        />
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
      <DocumentListToolbar
        title={title}
        total={displayTotal}
        onSearch={handleSearch}
        isSearchActive={isSearchActive}
        onTypeFilter={setTypeFilter}
        selectedType={typeFilter}
      />
      <div className="flex-1 overflow-y-auto">
        {displayDocuments.map((doc) => (
          <DocumentListItem
            key={doc.id}
            document={doc}
            isSelected={doc.id === selectedId}
            onClick={() => selectDocument(doc.id)}
            onDoubleClick={() => openDocument(doc.id)}
            onMutate={() => mutate()}
            snippet={isSearchActive ? (doc as any).snippet : undefined}
          />
        ))}
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
