import { NextRequest } from "next/server";
import { getDenylist, addToDenylist } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const entries = await getDenylist(ctx);
      return json(entries);
    } catch {
      return jsonError("Failed to fetch denylist", "FETCH_ERROR", 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Record<string, unknown>;
      const { domain, reason } = body as { domain?: string; reason?: string };

      if (!domain) {
        return jsonError("Domain is required", "MISSING_DOMAIN", 400);
      }

      const entry = await addToDenylist(ctx, { domain, reason });
      return json(entry, 201);
    } catch {
      return jsonError("Failed to add to denylist", "CREATE_ERROR", 500);
    }
  });
}
