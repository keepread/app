import { NextRequest } from "next/server";
import { generateApiKey, listApiKeys } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const keys = await listApiKeys(db);
      return json(keys);
    } catch {
      return jsonError("Failed to list API keys", "FETCH_ERROR", 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const body = (await request.json()) as Record<string, unknown>;
      const { label } = body as { label?: string };

      if (!label || !label.trim()) {
        return jsonError("Label is required", "MISSING_LABEL", 400);
      }

      const result = await generateApiKey(db, label.trim());
      return json(result, 201);
    } catch {
      return jsonError("Failed to create API key", "CREATE_ERROR", 500);
    }
  });
}
