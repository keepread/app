"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ListDocumentsQuery, DocumentLocation } from "@focus-reader/shared";
import { useDocuments } from "@/hooks/use-documents";
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
  isStarred?: boolean;
  title: string;
}

export function DocumentList({
  location,
  tagId,
  subscriptionId,
  isStarred,
  title,
}: DocumentListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("doc");
  const { setSelectedDocumentId } = useApp();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const query: ListDocumentsQuery = {
    location,
    tagId,
    subscriptionId,
    isStarred,
    sortBy: "saved_at",
    sortDir: "desc",
  };

  const { documents, total, isLoading, isLoadingMore, hasMore, loadMore } =
    useDocuments(query);

  // Infinite scroll observer
  useEffect(() => {
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
  }, [hasMore, loadMore]);

  const selectDocument = useCallback(
    (id: string) => {
      setSelectedDocumentId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, setSelectedDocumentId]
  );

  const openDocument = useCallback(
    (id: string) => {
      selectDocument(id);
    },
    [selectDocument]
  );

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <DocumentListToolbar title={title} total={0} />
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

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <DocumentListToolbar title={title} total={0} />
        <EmptyState location={location} isStarred={isStarred} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <DocumentListToolbar title={title} total={total} />
      <div className="flex-1 overflow-y-auto">
        {documents.map((doc) => (
          <DocumentListItem
            key={doc.id}
            document={doc}
            isSelected={doc.id === selectedId}
            onClick={() => selectDocument(doc.id)}
            onDoubleClick={() => openDocument(doc.id)}
          />
        ))}
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="border-t px-4 py-1.5 text-xs text-muted-foreground text-right">
        Count: {total}
      </div>
    </div>
  );
}
