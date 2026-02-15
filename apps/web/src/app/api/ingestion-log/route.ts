import { NextRequest } from "next/server";
import { listIngestionLogs } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const logs = await listIngestionLogs(db);
      return json(logs);
    } catch {
      return jsonError("Failed to fetch ingestion logs", "FETCH_ERROR", 500);
    }
  });
}
