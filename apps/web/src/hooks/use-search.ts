"use client";

import useSWR from "swr";
import type {
  PaginatedResponse,
  DocumentWithTags,
  DocumentLocation,
  DocumentType,
} from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

type SearchResult = DocumentWithTags & { snippet: string };

const fetcher = (url: string) =>
  apiFetch<PaginatedResponse<SearchResult>>(url);

export function useSearch(
  query: string,
  options?: { location?: DocumentLocation; type?: DocumentType; tagId?: string }
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (options?.location) params.set("location", options.location);
  if (options?.type) params.set("type", options.type);
  if (options?.tagId) params.set("tagId", options.tagId);

  const shouldFetch = query.trim().length >= 2;

  const { data, error, isLoading } = useSWR(
    shouldFetch ? `/api/search?${params.toString()}` : null,
    fetcher
  );

  return {
    results: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
  };
}
