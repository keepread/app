import { NextRequest } from "next/server";
import { getPreferences, updatePreferences } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const prefs = await getPreferences(ctx);
      return json(prefs);
    } catch {
      return jsonError("Failed to get preferences", "PREFS_ERROR", 500);
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Record<string, unknown>;
      const prefs = await updatePreferences(ctx, body);
      return json(prefs);
    } catch {
      return jsonError("Failed to update preferences", "PREFS_ERROR", 500);
    }
  });
}
