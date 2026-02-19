import { NextRequest } from "next/server";
import {
  exportBulkMarkdown,
  exportHighlightsMarkdown,
} from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";
import type { DocumentLocation } from "@focus-reader/shared";
import JSZip from "jszip";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { searchParams } = new URL(request.url);
      const mode = searchParams.get("mode") ?? "documents";

      if (mode === "highlights") {
        const tagId = searchParams.get("tagId") ?? undefined;
        const md = await exportHighlightsMarkdown(ctx, { tagId });
        return new Response(md, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="highlights-export.md"`,
          },
        });
      }

      // Bulk document export as ZIP
      const tagId = searchParams.get("tagId") ?? undefined;
      const location = (searchParams.get("location") ?? undefined) as
        | DocumentLocation
        | undefined;
      const files = await exportBulkMarkdown(ctx, {
        tagId,
        location,
        includeHighlights: true,
      });

      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.filename, file.content);
      }
      const buffer = await zip.generateAsync({ type: "arraybuffer" });

      return new Response(buffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="focus-reader-export-${new Date().toISOString().split("T")[0]}.zip"`,
        },
      });
    } catch {
      return jsonError("Failed to export", "EXPORT_ERROR", 500);
    }
  });
}
