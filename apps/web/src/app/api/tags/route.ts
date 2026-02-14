import { NextRequest } from "next/server";
import { getTags, createNewTag } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const db = await getDb();
    const tags = await getTags(db);
    return json(tags);
  } catch {
    return jsonError("Failed to fetch tags", "FETCH_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const { name, color } = body as { name?: string; color?: string };

    if (!name) {
      return jsonError("Tag name is required", "MISSING_NAME", 400);
    }

    const tag = await createNewTag(db, { name, color });
    return json(tag, 201);
  } catch {
    return jsonError("Failed to create tag", "CREATE_ERROR", 500);
  }
}
