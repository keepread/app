import { NextRequest } from "next/server";
import { getCollectionDetail, patchCollection, removeCollection } from "@focus-reader/api";
import type { UpdateCollectionInput } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";
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
      const collection = await getCollectionDetail(ctx, id);
      if (!collection) {
        return jsonError("Collection not found", "NOT_FOUND", 404);
      }
      return json(collection);
    } catch {
      return jsonError("Failed to fetch collection", "FETCH_ERROR", 500);
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

      const updates: UpdateCollectionInput = {};
      if (body.name !== undefined) updates.name = body.name as string;
      if (body.description !== undefined) updates.description = body.description as string | null;

      await patchCollection(ctx, id, updates);
      return json({ success: true });
    } catch {
      return jsonError("Failed to update collection", "UPDATE_ERROR", 500);
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
      await removeCollection(ctx, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete collection", "DELETE_ERROR", 500);
    }
  });
}
