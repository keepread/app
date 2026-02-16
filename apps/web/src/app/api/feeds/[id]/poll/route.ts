import { NextRequest } from "next/server";
import { pollSingleFeed } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      const result = await pollSingleFeed(db, id);
      if (result.error === "Feed not found") {
        return jsonError("Feed not found", "NOT_FOUND", 404);
      }
      return json(result);
    } catch {
      return jsonError("Failed to poll feed", "POLL_ERROR", 500);
    }
  });
}
