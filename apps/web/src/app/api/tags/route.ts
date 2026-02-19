import { NextRequest } from "next/server";
import { getTags, createNewTag } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";
import { withCors, handlePreflight } from "@/lib/cors";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const tags = await getTags(ctx);
      return withCors(json(tags), origin);
    } catch {
      return withCors(jsonError("Failed to fetch tags", "FETCH_ERROR", 500), origin);
    }
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Record<string, unknown>;
      const { name, color } = body as { name?: string; color?: string };

      if (!name) {
        return withCors(jsonError("Tag name is required", "MISSING_NAME", 400), origin);
      }

      const tag = await createNewTag(ctx, { name, color });
      return withCors(json(tag, 201), origin);
    } catch {
      return withCors(jsonError("Failed to create tag", "CREATE_ERROR", 500), origin);
    }
  });
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}
