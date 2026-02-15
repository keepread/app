import { NextRequest } from "next/server";
import { getDocumentByUrlDetail } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";
import { withCors, handlePreflight } from "@/lib/cors";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  return withAuth(request, async () => {
    try {
      const url = request.nextUrl.searchParams.get("url");
      if (!url) {
        return withCors(jsonError("Missing url parameter", "BAD_REQUEST", 400), origin);
      }

      const db = await getDb();
      const doc = await getDocumentByUrlDetail(db, url);
      if (!doc) {
        return withCors(jsonError("Document not found", "NOT_FOUND", 404), origin);
      }

      return withCors(json(doc), origin);
    } catch (err) {
      return withCors(jsonError("Failed to look up document", "LOOKUP_ERROR", 500), origin);
    }
  });
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}
