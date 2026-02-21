import { NextRequest } from "next/server";
import { bulkMoveSelectedDocuments } from "@focus-reader/api";
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

type BulkUpdateBody =
  | {
      scope: "selected";
      ids: string[];
      location: DocumentLocation;
    }
  | {
      scope: "filtered";
      filters?: Record<string, unknown>;
      location: DocumentLocation;
    };

const ALLOWED_LOCATIONS: ReadonlySet<DocumentLocation> = new Set(["inbox", "later", "archive"]);

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

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as BulkUpdateBody;

      if (!body || (body.scope !== "selected" && body.scope !== "filtered")) {
        return jsonError("Invalid bulk update payload", "INVALID_BODY", 400);
      }

      if (!ALLOWED_LOCATIONS.has(body.location)) {
        return jsonError("location must be one of inbox|later|archive", "INVALID_LOCATION", 400);
      }

      if (body.scope === "selected") {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return jsonError("ids must be a non-empty array", "INVALID_IDS", 400);
        }
        const updatedCount = await bulkMoveSelectedDocuments(ctx, {
          scope: "selected",
          ids: body.ids,
          location: body.location,
        });
        return json({ updatedCount });
      }

      const updatedCount = await bulkMoveSelectedDocuments(ctx, {
        scope: "filtered",
        query: parseFilters(body.filters),
        location: body.location,
      });

      return json({ updatedCount });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Too many IDs")) {
        return jsonError(error.message, "TOO_MANY_IDS", 400);
      }
      console.error("Bulk update failed", error);
      return jsonError("Failed to bulk update documents", "UPDATE_ERROR", 500);
    }
  });
}
