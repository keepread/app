import { NextRequest } from "next/server";
import { getDocumentDetail } from "@focus-reader/api";
import { getPdfMeta, scopeDb } from "@focus-reader/db";
import { getDb, getR2 } from "@/lib/bindings";
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
      const doc = await getDocumentDetail(ctx, id);
      if (!doc) {
        return jsonError("Document not found", "NOT_FOUND", 404);
      }

      if (doc.type === "pdf") {
        const pdfMeta = await getPdfMeta(db, doc.id);
        if (!pdfMeta) {
          return jsonError("PDF metadata not found", "NOT_FOUND", 404);
        }
        const r2 = await getR2();
        const obj = await r2.get(pdfMeta.storage_key);
        if (!obj) {
          return jsonError("PDF file not found", "NOT_FOUND", 404);
        }
        return new Response(obj.body, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${doc.title}.pdf"`,
          },
        });
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
