"use client";

import { use, useMemo } from "react";
import useSWR from "swr";
import { Filter } from "lucide-react";
import type { SavedView, ViewQueryAst, ViewSortConfig } from "@focus-reader/shared";
import { queryAstToDocumentQuery, applySortConfig } from "@focus-reader/api";
import { apiFetch } from "@/lib/api-client";
import { DocumentList } from "@/components/documents/document-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function SavedViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: view, isLoading } = useSWR(
    `/api/saved-views/${id}`,
    (url: string) => apiFetch<SavedView>(url)
  );

  const queryProps = useMemo(() => {
    if (!view) return null;
    try {
      const ast: ViewQueryAst = JSON.parse(view.query_ast_json);
      let query = queryAstToDocumentQuery(ast);

      if (view.sort_json) {
        const sortConfig: ViewSortConfig = JSON.parse(view.sort_json);
        query = applySortConfig(query, sortConfig);
      }

      return query;
    } catch {
      return null;
    }
  }, [view]);

  if (isLoading || !view) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!queryProps) {
    return (
      <div className="flex-1 p-6">
        <p className="text-muted-foreground">Invalid view configuration</p>
      </div>
    );
  }

  return (
    <DocumentList
      title={view.name}
      icon={Filter}
      location={queryProps.location}
      tagId={queryProps.tagId}
      subscriptionId={queryProps.subscriptionId}
      feedId={queryProps.feedId}
      isStarred={queryProps.isStarred}
      type={queryProps.type}
      status={queryProps.status}
      savedAfter={queryProps.savedAfter}
      savedBefore={queryProps.savedBefore}
      sortBy={queryProps.sortBy}
      sortDir={queryProps.sortDir}
    />
  );
}
