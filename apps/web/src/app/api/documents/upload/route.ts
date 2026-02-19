import { NextRequest } from "next/server";
import { createPdfDocument } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb, getR2 } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return jsonError("No file provided", "VALIDATION_ERROR", 400);
      }

      if (file.type !== "application/pdf") {
        return jsonError("Only PDF files are supported", "VALIDATION_ERROR", 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return jsonError("File too large (max 50MB)", "VALIDATION_ERROR", 400);
      }

      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const r2 = await getR2();
      const buffer = await file.arrayBuffer();
      const doc = await createPdfDocument(ctx, r2, buffer, file.name);

      return json(doc, 201);
    } catch {
      return jsonError("Failed to upload PDF", "UPLOAD_ERROR", 500);
    }
  });
}
