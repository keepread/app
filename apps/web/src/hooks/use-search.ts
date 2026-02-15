"use client";

import useSWR from "swr";
import type {
  PaginatedResponse,
  DocumentWithTags,
  DocumentLocation,
} from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

type SearchResult = DocumentWithTags & { snippet: string };

const fetcher = (url: string) =>
  apiFetch<PaginatedResponse<SearchResult>>(url);

export function useSearch(
  query: string,
  options?: { location?: DocumentLocation }
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (options?.location) params.set("location", options.location);

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
