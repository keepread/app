import { NextRequest } from "next/server";
import { removeFromDenylist } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      await removeFromDenylist(ctx, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to remove from denylist", "DELETE_ERROR", 500);
    }
  });
}
