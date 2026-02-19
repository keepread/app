import { NextRequest } from "next/server";
import { patchSubscription, removeSubscription, tagSubscription, untagSubscription } from "@focus-reader/api";
import type { UpdateSubscriptionInput } from "@focus-reader/shared";
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

      // Handle tag operations separately
      if (typeof body.addTagId === "string") {
        await tagSubscription(ctx, id, body.addTagId);
        return json({ success: true });
      }
      if (typeof body.removeTagId === "string") {
        await untagSubscription(ctx, id, body.removeTagId);
        return json({ success: true });
      }

      // Only pass allowed fields to updateSubscription
      const updates: UpdateSubscriptionInput = {};
      if (body.display_name !== undefined) updates.display_name = body.display_name as string;
      if (body.is_active !== undefined) updates.is_active = body.is_active as number;
      if (body.auto_tag_rules !== undefined) updates.auto_tag_rules = body.auto_tag_rules as string | null;

      await patchSubscription(ctx, id, updates);
      return json({ success: true });
    } catch {
      return jsonError("Failed to update subscription", "UPDATE_ERROR", 500);
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
      const hard = request.nextUrl.searchParams.get("hard") === "true";
      await removeSubscription(ctx, id, hard);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete subscription", "DELETE_ERROR", 500);
    }
  });
}
