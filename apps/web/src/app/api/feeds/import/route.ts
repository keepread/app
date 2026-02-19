import { NextRequest } from "next/server";
import { importOpml } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);

      let xml: string;
      const contentType = request.headers.get("content-type") ?? "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
          return jsonError("file field is required", "MISSING_FILE", 400);
        }
        xml = await file.text();
      } else {
        xml = await request.text();
      }

      if (!xml.trim()) {
        return jsonError("OPML content is required", "MISSING_BODY", 400);
      }

      const result = await importOpml(ctx, xml);
      return json(result);
    } catch {
      return jsonError("Failed to import OPML", "IMPORT_ERROR", 500);
    }
  });
}
