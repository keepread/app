"use client";

import useSWR from "swr";
import type { Collection, CollectionWithCount, CollectionWithDocuments } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

export function useCollections() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/collections",
    (url: string) => apiFetch<CollectionWithCount[]>(url)
  );

  return {
    collections: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useCollectionsForDocument(documentId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    documentId ? `/api/documents/${documentId}/collections` : null,
    (url: string) => apiFetch<Collection[]>(url)
  );

  return {
    collections: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useCollection(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/collections/${id}` : null,
    (url: string) => apiFetch<CollectionWithDocuments>(url)
  );

  return {
    collection: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
