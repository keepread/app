import { NextRequest } from "next/server";
import { scopeDb } from "@focus-reader/db";
import { getDocument } from "@focus-reader/db";
import { getDb, getR2 } from "@/lib/bindings";
import { jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; contentId: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { documentId, contentId } = await params;

      // Verify document belongs to user
      const doc = await getDocument(ctx, documentId);
      if (!doc) {
        return jsonError("Document not found", "NOT_FOUND", 404);
      }

      const r2 = await getR2();
      const storageKey = `attachments/${documentId}/${contentId}`;
      const obj = await r2.get(storageKey);

      if (!obj) {
        return jsonError("Attachment not found", "NOT_FOUND", 404);
      }

      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return jsonError("Failed to fetch attachment", "FETCH_ERROR", 500);
    }
  });
}
