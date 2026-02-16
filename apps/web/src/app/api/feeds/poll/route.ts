import { NextRequest } from "next/server";
import { pollDueFeeds } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const results = await pollDueFeeds(db);
      return json({ results });
    } catch {
      return jsonError("Failed to poll feeds", "POLL_ERROR", 500);
    }
  });
}
