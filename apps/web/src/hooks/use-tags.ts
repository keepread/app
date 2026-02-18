"use client";

import useSWR from "swr";
import type { TagWithCount } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

const EMPTY_TAGS: TagWithCount[] = [];

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/tags",
    (url: string) => apiFetch<TagWithCount[]>(url)
  );

  return {
    tags: data ?? EMPTY_TAGS,
    isLoading,
    error,
    mutate,
  };
}
