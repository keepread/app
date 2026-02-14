import { NextRequest } from "next/server";
import { patchSubscription, removeSubscription } from "@focus-reader/api";
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
    await patchSubscription(db, id, body);
    return json({ success: true });
  } catch {
    return jsonError("Failed to update subscription", "UPDATE_ERROR", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    await removeSubscription(db, id);
    return json({ success: true });
  } catch {
    return jsonError("Failed to delete subscription", "DELETE_ERROR", 500);
  }
}
