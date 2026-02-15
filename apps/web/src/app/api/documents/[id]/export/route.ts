import { NextRequest } from "next/server";
import { exportDocumentMarkdown } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const format = (searchParams.get("highlightFormat") ?? "appendix") as
        | "inline"
        | "appendix";

      const md = await exportDocumentMarkdown(db, id, {
        includeHighlights: true,
        highlightFormat: format,
      });

      if (!md) {
        return jsonError("Document not found", "NOT_FOUND", 404);
      }

      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="document-${id}.md"`,
        },
      });
    } catch {
      return jsonError("Failed to export", "EXPORT_ERROR", 500);
    }
  });
}
