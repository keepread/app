import { NextRequest } from "next/server";
import { getDocumentDetail, patchDocument, removeDocument, tagDocument, untagDocument } from "@focus-reader/api";
import type { UpdateDocumentInput } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const doc = await getDocumentDetail(ctx, id);
      if (!doc) {
        return jsonError("Document not found", "NOT_FOUND", 404);
      }
      return json(doc);
    } catch {
      return jsonError("Failed to fetch document", "FETCH_ERROR", 500);
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;

      // Handle tag operations separately
      if (typeof body.addTagId === "string") {
        await tagDocument(ctx, id, body.addTagId);
        return json({ success: true });
      }
      if (typeof body.removeTagId === "string") {
        await untagDocument(ctx, id, body.removeTagId);
        return json({ success: true });
      }

      // Only pass allowed fields to updateDocument
      const updates: UpdateDocumentInput = {};
      if (body.title !== undefined) updates.title = body.title as string;
      if (body.location !== undefined) updates.location = body.location as UpdateDocumentInput["location"];
      if (body.is_read !== undefined) updates.is_read = body.is_read as number;
      if (body.is_starred !== undefined) updates.is_starred = body.is_starred as number;
      if (body.reading_progress !== undefined) updates.reading_progress = body.reading_progress as number;
      if (body.last_read_at !== undefined) updates.last_read_at = body.last_read_at as string | null;

      await patchDocument(ctx, id, updates);
      return json({ success: true });
    } catch {
      return jsonError("Failed to update document", "UPDATE_ERROR", 500);
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
      await removeDocument(ctx, id);
      return json({ success: true });
    } catch {
      return jsonError("Failed to delete document", "DELETE_ERROR", 500);
    }
  });
}
