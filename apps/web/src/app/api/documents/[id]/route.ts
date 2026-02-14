import { NextRequest } from "next/server";
import { getDocumentDetail, patchDocument, removeDocument } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const doc = await getDocumentDetail(db, id);
    if (!doc) {
      return jsonError("Document not found", "NOT_FOUND", 404);
    }
    return json(doc);
  } catch {
    return jsonError("Failed to fetch document", "FETCH_ERROR", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    await patchDocument(db, id, body);
    return json({ success: true });
  } catch {
    return jsonError("Failed to update document", "UPDATE_ERROR", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    await removeDocument(db, id);
    return json({ success: true });
  } catch {
    return jsonError("Failed to delete document", "DELETE_ERROR", 500);
  }
}
