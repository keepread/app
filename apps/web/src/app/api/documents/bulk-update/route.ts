import { NextRequest } from "next/server";
import { bulkMoveSelectedDocuments } from "@focus-reader/api";
import type { DocumentLocation } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

interface BulkUpdateBody {
  ids: string[];
  location: DocumentLocation;
}

const ALLOWED_LOCATIONS: ReadonlySet<DocumentLocation> = new Set(["inbox", "later", "archive"]);

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Partial<BulkUpdateBody>;

      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return jsonError("ids must be a non-empty array", "INVALID_IDS", 400);
      }

      if (!body.location || !ALLOWED_LOCATIONS.has(body.location)) {
        return jsonError("location must be one of inbox|later|archive", "INVALID_LOCATION", 400);
      }

      const updatedCount = await bulkMoveSelectedDocuments(ctx, {
        ids: body.ids,
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
