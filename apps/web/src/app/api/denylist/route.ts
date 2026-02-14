import { NextRequest } from "next/server";
import { getDenylist, addToDenylist } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const db = await getDb();
    const entries = await getDenylist(db);
    return json(entries);
  } catch {
    return jsonError("Failed to fetch denylist", "FETCH_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const { domain, reason } = body as { domain?: string; reason?: string };

    if (!domain) {
      return jsonError("Domain is required", "MISSING_DOMAIN", 400);
    }

    const entry = await addToDenylist(db, { domain, reason });
    return json(entry, 201);
  } catch {
    return jsonError("Failed to add to denylist", "CREATE_ERROR", 500);
  }
}
