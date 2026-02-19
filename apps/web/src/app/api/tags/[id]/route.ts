import { NextRequest } from "next/server";
import { patchTag, removeTag } from "@focus-reader/api";
import type { UpdateTagInput } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

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

      // Only pass allowed fields
      const updates: UpdateTagInput = {};
      if (body.name !== undefined) updates.name = body.name as string;
      if (body.color !== undefined) updates.color = body.color as string | null;
      if (body.description !== undefined) updates.description = body.description as string | null;

      await patchTag(ctx, id, updates);
      return json({ success: true });
    } catch {
      return jsonError("Failed to update tag", "UPDATE_ERROR", 500);
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
      await removeTag(ctx, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete tag", "DELETE_ERROR", 500);
    }
  });
}
