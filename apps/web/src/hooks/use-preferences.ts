"use client";

import useSWR from "swr";
import type { UserPreferences, UpdateUserPreferencesInput } from "@focus-reader/shared";
import { FONT_FAMILIES, FONT_SIZE_RANGE, LINE_HEIGHT_RANGE, CONTENT_WIDTH_RANGE } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";
import { useCallback } from "react";

export function usePreferences() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/preferences",
    (url: string) => apiFetch<UserPreferences>(url)
  );

  const updatePreference = useCallback(
    async (updates: UpdateUserPreferencesInput) => {
      // Optimistic update
      if (data) {
        mutate({ ...data, ...updates } as UserPreferences, false);
      }
      try {
        const result = await apiFetch<UserPreferences>("/api/preferences", {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        mutate(result, false);
      } catch {
        mutate(); // Revert on error
      }
    },
    [data, mutate]
  );

  const fontFamily =
    FONT_FAMILIES.find((f) => f.value === data?.font_family)?.css ??
    FONT_FAMILIES[0].css;

  return {
    preferences: data ?? null,
    isLoading,
    error,
    mutate,
    updatePreference,
    // Resolved CSS values
    fontFamily,
    fontSize: data?.font_size ?? FONT_SIZE_RANGE.default,
    lineHeight: data?.line_height ?? LINE_HEIGHT_RANGE.default,
    contentWidth: data?.content_width ?? CONTENT_WIDTH_RANGE.default,
  };
}
