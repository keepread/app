import { NextRequest } from "next/server";
import { updateView, deleteView } from "@focus-reader/api";
import { getSavedView, scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const view = await getSavedView(ctx, id);
      if (!view) {
        return jsonError("Saved view not found", "NOT_FOUND", 404);
      }
      return json(view);
    } catch {
      return jsonError("Failed to fetch saved view", "FETCH_ERROR", 500);
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;

      await updateView(ctx, id, {
        name: body.name as string | undefined,
        query_ast_json: body.query_ast_json as string | undefined,
        sort_json: body.sort_json as string | null | undefined,
        pinned_order: body.pinned_order as number | null | undefined,
      });

      return json({ success: true });
    } catch {
      return jsonError("Failed to update saved view", "UPDATE_ERROR", 500);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;

      const view = await getSavedView(ctx, id);
      if (!view) {
        return jsonError("Saved view not found", "NOT_FOUND", 404);
      }
      if (view.is_system === 1) {
        return jsonError(
          "Cannot delete system views",
          "VALIDATION_ERROR",
          400
        );
      }

      await deleteView(ctx, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete saved view", "DELETE_ERROR", 500);
    }
  });
}
