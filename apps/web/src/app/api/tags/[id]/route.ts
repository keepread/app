import { NextRequest } from "next/server";
import { patchTag, removeTag } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    await patchTag(db, id, body);
    return json({ success: true });
  } catch {
    return jsonError("Failed to update tag", "UPDATE_ERROR", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    await removeTag(db, id);
    return json({ success: true });
  } catch {
    return jsonError("Failed to delete tag", "DELETE_ERROR", 500);
  }
}
