import { NextRequest } from "next/server";
import { searchDocuments } from "@focus-reader/api";
import type { DocumentLocation, DocumentType } from "@focus-reader/shared";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const params = request.nextUrl.searchParams;

    const q = params.get("q");
    if (!q || !q.trim()) {
      return jsonError("Query parameter 'q' is required", "MISSING_QUERY", 400);
    }

    const result = await searchDocuments(db, {
      q,
      location: (params.get("location") as DocumentLocation) || undefined,
      type: (params.get("type") as DocumentType) || undefined,
      tagId: params.get("tagId") || undefined,
      limit: params.get("limit") ? parseInt(params.get("limit")!) : undefined,
      offset: params.get("offset") ? parseInt(params.get("offset")!) : undefined,
    });

    return json(result);
  } catch (err) {
    return jsonError("Failed to search documents", "SEARCH_ERROR", 500);
  }
}
