import { NextRequest } from "next/server";
import { previewBulkDeleteDocuments } from "@focus-reader/api";
import type {
  DocumentLocation,
  DocumentType,
  ListDocumentsQuery,
  SortDirection,
  SortField,
} from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

function parseFilters(input?: Record<string, unknown>): ListDocumentsQuery {
  if (!input) return {};
  return {
    location: input.location as DocumentLocation | undefined,
    status: input.status as "read" | "unread" | undefined,
    tagId: input.tagId as string | undefined,
    subscriptionId: input.subscriptionId as string | undefined,
    feedId: input.feedId as string | undefined,
    type: input.type as DocumentType | undefined,
    search: input.search as string | undefined,
    sortBy: input.sortBy as SortField | undefined,
    sortDir: input.sortDir as SortDirection | undefined,
    isStarred: input.isStarred === true ? true : undefined,
    savedAfter: input.savedAfter as string | undefined,
    savedBefore: input.savedBefore as string | undefined,
  };
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as { filters?: Record<string, unknown> };
      const count = await previewBulkDeleteDocuments(ctx, parseFilters(body?.filters));
      return json({ count });
    } catch {
      return jsonError("Failed to preview bulk delete", "PREVIEW_ERROR", 500);
    }
  });
}
