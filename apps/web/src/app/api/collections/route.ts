import { NextRequest } from "next/server";
import { getCollections, createCollection } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const collections = await getCollections(ctx);
      return json(collections);
    } catch {
      return jsonError("Failed to fetch collections", "FETCH_ERROR", 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Record<string, unknown>;
      const { name, description } = body as { name?: string; description?: string };

      if (!name) {
        return jsonError("name is required", "MISSING_NAME", 400);
      }

      const collection = await createCollection(ctx, { name, description });
      return json(collection, 201);
    } catch {
      return jsonError("Failed to create collection", "CREATE_ERROR", 500);
    }
  });
}
