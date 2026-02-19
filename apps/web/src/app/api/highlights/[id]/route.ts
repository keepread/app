import { NextRequest } from "next/server";
import {
  patchHighlight,
  removeHighlight,
} from "@focus-reader/api";
import { getHighlightWithTags, scopeDb } from "@focus-reader/db";
import type { UpdateHighlightInput } from "@focus-reader/shared";
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
      const highlight = await getHighlightWithTags(ctx, id);
      if (!highlight) {
        return jsonError("Highlight not found", "NOT_FOUND", 404);
      }
      return json(highlight);
    } catch {
      return jsonError("Failed to fetch highlight", "FETCH_ERROR", 500);
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

      const updates: UpdateHighlightInput = {};
      if (body.text !== undefined) updates.text = body.text as string;
      if (body.note !== undefined) updates.note = body.note as string | null;
      if (body.color !== undefined) updates.color = body.color as string;

      await patchHighlight(ctx, id, updates);
      return json({ success: true });
    } catch {
      return jsonError("Failed to update highlight", "UPDATE_ERROR", 500);
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
      await removeHighlight(ctx, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete highlight", "DELETE_ERROR", 500);
    }
  });
}
