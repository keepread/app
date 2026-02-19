import { NextRequest } from "next/server";
import { addToCollection, removeFromCollection } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;
      const { documentId } = body as { documentId?: string };

      if (!documentId) {
        return jsonError("documentId is required", "MISSING_DOCUMENT_ID", 400);
      }

      await addToCollection(ctx, id, documentId);
      return json({ success: true });
    } catch {
      return jsonError("Failed to add document", "ADD_ERROR", 500);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;
      const { documentId } = body as { documentId?: string };

      if (!documentId) {
        return jsonError("documentId is required", "MISSING_DOCUMENT_ID", 400);
      }

      await removeFromCollection(ctx, id, documentId);
      return json({ success: true });
    } catch {
      return jsonError("Failed to remove document", "REMOVE_ERROR", 500);
    }
  });
}
