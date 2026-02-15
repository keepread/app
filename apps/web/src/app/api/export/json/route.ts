import { NextRequest } from "next/server";
import { exportAllJson } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const data = await exportAllJson(db);
      const json = JSON.stringify(data, null, 2);
      return new Response(json, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="focus-reader-export-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    } catch {
      return jsonError("Failed to export", "EXPORT_ERROR", 500);
    }
  });
}
