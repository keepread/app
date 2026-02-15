import { NextRequest } from "next/server";
import { getDocumentCollections } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      const collections = await getDocumentCollections(db, id);
      return json(collections);
    } catch {
      return jsonError("Failed to get collections", "COLLECTIONS_ERROR", 500);
    }
  });
}
