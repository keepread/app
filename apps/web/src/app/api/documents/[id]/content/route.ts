import { NextRequest } from "next/server";
import { getDocumentDetail } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      const doc = await getDocumentDetail(db, id);
      if (!doc) {
        return jsonError("Document not found", "NOT_FOUND", 404);
      }
      return json({
        htmlContent: doc.html_content,
        markdownContent: doc.markdown_content,
      });
    } catch {
      return jsonError("Failed to fetch content", "FETCH_ERROR", 500);
    }
  });
}
