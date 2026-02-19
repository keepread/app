import { NextRequest } from "next/server";
import { tagSubscription, untagSubscription } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;
      const { tagId } = body as { tagId?: string };

      if (!tagId) {
        return jsonError("tagId is required", "MISSING_TAG_ID", 400);
      }

      await tagSubscription(ctx, id, tagId);
      return json({ success: true });
    } catch {
      return jsonError("Failed to add tag", "TAG_ERROR", 500);
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
      const body = (await request.json()) as Record<string, unknown>;
      const { tagId } = body as { tagId?: string };

      if (!tagId) {
        return jsonError("tagId is required", "MISSING_TAG_ID", 400);
      }

      await untagSubscription(ctx, id, tagId);
      return json({ success: true });
    } catch {
      return jsonError("Failed to remove tag", "TAG_ERROR", 500);
    }
  });
}
