import { NextRequest } from "next/server";
import { getAllHighlights } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const url = new URL(request.url);
      const tagId = url.searchParams.get("tagId") ?? undefined;
      const color = url.searchParams.get("color") ?? undefined;
      const limit = url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!, 10)
        : undefined;
      const cursor = url.searchParams.get("cursor") ?? undefined;

      const result = await getAllHighlights(ctx, { tagId, color, limit, cursor });
      return json(result);
    } catch {
      return jsonError("Failed to fetch highlights", "FETCH_ERROR", 500);
    }
  });
}
