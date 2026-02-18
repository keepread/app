"use client";

import useSWR from "swr";
import type { FeedWithStats } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

const EMPTY_FEEDS: FeedWithStats[] = [];

export function useFeeds() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/feeds",
    (url: string) => apiFetch<FeedWithStats[]>(url)
  );

  return {
    feeds: data ?? EMPTY_FEEDS,
    isLoading,
    error,
    mutate,
  };
}

export function useFeed(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/feeds/${id}` : null,
    (url: string) => apiFetch<FeedWithStats>(url)
  );

  return {
    feed: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
