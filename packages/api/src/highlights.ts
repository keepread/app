import type {
  CreateHighlightInput,
  UpdateHighlightInput,
  HighlightWithTags,
  HighlightWithDocument,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  createHighlight as dbCreateHighlight,
  getHighlightWithTags,
  listHighlightsForDocument,
  listAllHighlights,
  updateHighlight,
  deleteHighlight,
  addTagToHighlight,
  removeTagFromHighlight,
} from "@focus-reader/db";

export async function getHighlightsForDocument(
  ctx: UserScopedDb,
  documentId: string
): Promise<HighlightWithTags[]> {
  return listHighlightsForDocument(ctx, documentId);
}

export async function getAllHighlights(
  ctx: UserScopedDb,
  options?: { tagId?: string; color?: string; limit?: number; cursor?: string }
): Promise<{ items: HighlightWithDocument[]; total: number; nextCursor?: string }> {
  return listAllHighlights(ctx, options);
}

export async function createHighlight(
  ctx: UserScopedDb,
  input: CreateHighlightInput
): Promise<HighlightWithTags> {
  const highlight = await dbCreateHighlight(ctx, input);
  return { ...highlight, tags: [] };
}

export async function patchHighlight(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateHighlightInput
): Promise<void> {
  await updateHighlight(ctx, id, updates);
}

export async function removeHighlight(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  await deleteHighlight(ctx, id);
}

export async function tagHighlight(
  ctx: UserScopedDb,
  highlightId: string,
  tagId: string
): Promise<void> {
  await addTagToHighlight(ctx, highlightId, tagId);
}

export async function untagHighlight(
  ctx: UserScopedDb,
  highlightId: string,
  tagId: string
): Promise<void> {
  await removeTagFromHighlight(ctx, highlightId, tagId);
}
