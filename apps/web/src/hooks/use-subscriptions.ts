"use client";

import useSWR from "swr";
import type { SubscriptionWithStats } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";

export function useSubscriptions() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/subscriptions",
    (url: string) => apiFetch<SubscriptionWithStats[]>(url)
  );

  return {
    subscriptions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
