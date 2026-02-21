import { NextRequest } from "next/server";
import { bulkDeleteDocuments } from "@focus-reader/api";
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

type BulkDeleteBody =
  | {
      scope: "selected";
      ids: string[];
    }
  | {
      scope: "filtered";
      filters?: Record<string, unknown>;
    };

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
      const body = (await request.json()) as BulkDeleteBody;

      if (!body || (body.scope !== "selected" && body.scope !== "filtered")) {
        return jsonError("Invalid bulk delete payload", "INVALID_BODY", 400);
      }

      if (body.scope === "selected") {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return jsonError("ids must be a non-empty array", "INVALID_IDS", 400);
        }
        const deletedCount = await bulkDeleteDocuments(ctx, {
          scope: "selected",
          ids: body.ids,
        });
        return json({ deletedCount });
      }

      const deletedCount = await bulkDeleteDocuments(ctx, {
        scope: "filtered",
        query: parseFilters(body.filters),
      });
      return json({ deletedCount });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Too many IDs")) {
        return jsonError(error.message, "TOO_MANY_IDS", 400);
      }
      return jsonError("Failed to bulk delete documents", "DELETE_ERROR", 500);
    }
  });
}
