import { NextRequest } from "next/server";
import { getPreferences, updatePreferences } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const prefs = await getPreferences(db);
      return json(prefs);
    } catch {
      return jsonError("Failed to get preferences", "PREFS_ERROR", 500);
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const body = (await request.json()) as Record<string, unknown>;
      const prefs = await updatePreferences(db, body);
      return json(prefs);
    } catch {
      return jsonError("Failed to update preferences", "PREFS_ERROR", 500);
    }
  });
}
