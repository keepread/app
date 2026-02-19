import { NextRequest } from "next/server";
import { getHighlightsForDocument, createHighlight } from "@focus-reader/api";
import type { CreateHighlightInput } from "@focus-reader/shared";
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
      const highlights = await getHighlightsForDocument(ctx, id);
      return json(highlights);
    } catch {
      return jsonError("Failed to fetch highlights", "FETCH_ERROR", 500);
    }
  });
}

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
      const { text, note, color, position_selector, position_percent } = body as Partial<CreateHighlightInput>;

      if (!text) {
        return jsonError("text is required", "MISSING_TEXT", 400);
      }

      const highlight = await createHighlight(ctx, {
        document_id: id,
        text,
        note: note ?? null,
        color,
        position_selector: position_selector ?? null,
        position_percent,
      });

      return json(highlight, 201);
    } catch {
      return jsonError("Failed to create highlight", "CREATE_ERROR", 500);
    }
  });
}
