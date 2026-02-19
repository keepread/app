import { NextRequest } from "next/server";
import { patchFeed, removeFeed, tagFeed, untagFeed } from "@focus-reader/api";
import type { UpdateFeedInput } from "@focus-reader/shared";
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
        await tagFeed(ctx, id, body.addTagId);
        return json({ success: true });
      }
      if (typeof body.removeTagId === "string") {
        await untagFeed(ctx, id, body.removeTagId);
        return json({ success: true });
      }

      // Only pass allowed fields to patchFeed
      const updates: UpdateFeedInput = {};
      if (body.title !== undefined) updates.title = body.title as string;
      if (body.description !== undefined) updates.description = body.description as string | null;
      if (body.icon_url !== undefined) updates.icon_url = body.icon_url as string | null;
      if (body.fetch_interval_minutes !== undefined) updates.fetch_interval_minutes = body.fetch_interval_minutes as number;
      if (body.is_active !== undefined) updates.is_active = body.is_active as number;
      if (body.fetch_full_content !== undefined) updates.fetch_full_content = body.fetch_full_content as number;
      if (body.auto_tag_rules !== undefined) updates.auto_tag_rules = body.auto_tag_rules as string | null;

      await patchFeed(ctx, id, updates);
      return json({ success: true });
    } catch {
      return jsonError("Failed to update feed", "UPDATE_ERROR", 500);
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
      await removeFeed(ctx, id, hard);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete feed", "DELETE_ERROR", 500);
    }
  });
}
