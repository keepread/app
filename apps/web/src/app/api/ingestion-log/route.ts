import { NextRequest } from "next/server";
import { listIngestionLogs, scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const logs = await listIngestionLogs(ctx);
      return json(logs);
    } catch {
      return jsonError("Failed to fetch ingestion logs", "FETCH_ERROR", 500);
    }
  });
}
