"use client";

import { useMemo } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import type {
  PaginatedResponse,
  DocumentWithTags,
  ListDocumentsQuery,
} from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

function buildSearchParams(query: ListDocumentsQuery): string {
  const params = new URLSearchParams();
  if (query.location) params.set("location", query.location);
  if (query.status) params.set("status", query.status);
  if (query.tagId) params.set("tagId", query.tagId);
  if (query.subscriptionId) params.set("subscriptionId", query.subscriptionId);
  if (query.search) params.set("search", query.search);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  if (query.feedId) params.set("feedId", query.feedId);
  if (query.type) params.set("type", query.type);
  if (query.isStarred) params.set("isStarred", "true");
  if (query.limit) params.set("limit", String(query.limit));
  if (query.savedAfter) params.set("savedAfter", query.savedAfter);
  if (query.savedBefore) params.set("savedBefore", query.savedBefore);
  return params.toString();
}

const fetcher = (url: string) => apiFetch<PaginatedResponse<DocumentWithTags>>(url);

export function useDocuments(query: ListDocumentsQuery) {
  const getKey = (
    pageIndex: number,
    previousPageData: PaginatedResponse<DocumentWithTags> | null
  ) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    const base = buildSearchParams(query);
    const cursor = previousPageData?.nextCursor
      ? `&cursor=${encodeURIComponent(previousPageData.nextCursor)}`
      : "";
    return `/api/documents?${base}${cursor}`;
  };

  const { data, error, size, setSize, isValidating, mutate } =
    useSWRInfinite(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnMount: true,
    });

  const documents = useMemo(() => data ? data.flatMap((page) => page.items) : [], [data]);
  const total = data?.[0]?.total ?? 0;
  const isLoading = !data && !error;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");
  const hasMore = data ? !!data[data.length - 1]?.nextCursor : false;

  const loadMore = () => {
    if (hasMore && !isValidating) setSize(size + 1);
  };

  return { documents, total, isLoading, isLoadingMore, hasMore, loadMore, mutate };
}

export function useDocument(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/documents/${id}` : null,
    (url: string) => apiFetch<DocumentWithTags>(url)
  );

  return { document: data ?? null, isLoading, error, mutate };
}

export function useDocumentContent(id: string | null) {
  const { data, error, isLoading } = useSWR(
    id ? `/api/documents/${id}/content` : null,
    (url: string) =>
      apiFetch<{ htmlContent: string | null; markdownContent: string | null }>(url)
  );

  return {
    htmlContent: data?.htmlContent ?? null,
    markdownContent: data?.markdownContent ?? null,
    isLoading,
    error,
  };
}
