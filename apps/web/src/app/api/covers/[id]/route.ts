import { NextRequest } from "next/server";
import { getDocumentCoverInfo, enrichDocument, scopeDb } from "@focus-reader/db";
import { getDb, getR2 } from "@/lib/bindings";
import { jsonError } from "@/lib/api-helpers";
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
      const doc = await getDocumentCoverInfo(ctx, id);
      if (!doc) {
        return jsonError("Document not found", "NOT_FOUND", 404);
      }

      // Try R2 cached version first
      if (doc.cover_image_r2_key) {
        const r2 = await getR2();
        const obj = await r2.get(doc.cover_image_r2_key);
        if (obj) {
          return new Response(obj.body, {
            headers: {
              "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
              "Cache-Control": "public, max-age=604800, immutable",
            },
          });
        }
        // R2 object missing despite key being set — clear the stale key so
        // subsequent cacheDocumentCoverImage calls can re-cache it
        await enrichDocument(ctx, id, { cover_image_r2_key: null });
      }

      // Fall back to proxying external URL
      if (doc.cover_image_url) {
        return Response.redirect(
          new URL(
            `/api/image-proxy?url=${encodeURIComponent(doc.cover_image_url)}`,
            request.url
          ),
          302
        );
      }

      return jsonError("No cover image", "NOT_FOUND", 404);
    } catch {
      return jsonError("Failed to fetch cover image", "FETCH_ERROR", 500);
    }
  });
}
