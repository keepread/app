import { NextRequest } from "next/server";
import { revokeApiKey } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      await revokeApiKey(db, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to revoke API key", "DELETE_ERROR", 500);
    }
  });
}
