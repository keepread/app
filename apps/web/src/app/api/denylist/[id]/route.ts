import { NextRequest } from "next/server";
import { removeFromDenylist } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    await removeFromDenylist(db, id);
    return json({ success: true });
  } catch {
    return jsonError("Failed to remove from denylist", "DELETE_ERROR", 500);
  }
}
