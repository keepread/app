import { NextRequest } from "next/server";
import { tagDocument, untagDocument } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;
      const { tagId } = body as { tagId?: string };

      if (!tagId) {
        return jsonError("tagId is required", "MISSING_TAG_ID", 400);
      }

      await tagDocument(db, id, tagId);
      return json({ success: true });
    } catch {
      return jsonError("Failed to add tag", "TAG_ERROR", 500);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;
      const { tagId } = body as { tagId?: string };

      if (!tagId) {
        return jsonError("tagId is required", "MISSING_TAG_ID", 400);
      }

      await untagDocument(db, id, tagId);
      return json({ success: true });
    } catch {
      return jsonError("Failed to remove tag", "TAG_ERROR", 500);
    }
  });
}
