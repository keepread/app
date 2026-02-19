import type {
  Highlight,
  CreateHighlightInput,
  UpdateHighlightInput,
  HighlightWithTags,
  HighlightWithDocument,
  Tag,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createHighlight(
  ctx: UserScopedDb,
  input: CreateHighlightInput
): Promise<Highlight> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  await ctx.db
    .prepare(
      `INSERT INTO highlight (id, user_id, document_id, text, note, color, position_selector, position_percent, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(
      id,
      ctx.userId,
      input.document_id,
      input.text,
      input.note ?? null,
      input.color ?? "#FFFF00",
      input.position_selector ?? null,
      input.position_percent ?? 0,
      now,
      now
    )
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM highlight WHERE id = ?1")
    .bind(id)
    .first<Highlight>())!;
}

export async function getHighlight(
  ctx: UserScopedDb,
  id: string
): Promise<Highlight | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM highlight WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .first<Highlight>();
  return result ?? null;
}

export async function getHighlightWithTags(
  ctx: UserScopedDb,
  id: string
): Promise<HighlightWithTags | null> {
  const highlight = await getHighlight(ctx, id);
  if (!highlight) return null;

  const tags = await getTagsForHighlight(ctx.db, id);
  return { ...highlight, tags };
}

export async function listHighlightsForDocument(
  ctx: UserScopedDb,
  documentId: string
): Promise<HighlightWithTags[]> {
  const result = await ctx.db
    .prepare(
      `SELECT * FROM highlight
       WHERE document_id = ?1 AND user_id = ?2
       ORDER BY position_percent ASC`
    )
    .bind(documentId, ctx.userId)
    .all<Highlight>();

  const highlights: HighlightWithTags[] = [];
  for (const h of result.results) {
    const tags = await getTagsForHighlight(ctx.db, h.id);
    highlights.push({ ...h, tags });
  }
  return highlights;
}

export async function listAllHighlights(
  ctx: UserScopedDb,
  options?: { tagId?: string; color?: string; limit?: number; cursor?: string }
): Promise<{ items: HighlightWithDocument[]; total: number; nextCursor?: string }> {
  const limit = options?.limit ?? 20;
  const conditions: string[] = ["h.user_id = ?1"];
  const params: unknown[] = [ctx.userId];
  let paramIdx = 2;

  if (options?.color) {
    conditions.push(`h.color = ?${paramIdx}`);
    params.push(options.color);
    paramIdx++;
  }

  if (options?.tagId) {
    conditions.push(`EXISTS (SELECT 1 FROM highlight_tags ht2 WHERE ht2.highlight_id = h.id AND ht2.tag_id = ?${paramIdx})`);
    params.push(options.tagId);
    paramIdx++;
  }

  if (options?.cursor) {
    // Composite cursor: "created_at|id" for stable pagination
    const [cursorDate, cursorId] = options.cursor.split("|");
    conditions.push(`(h.created_at < ?${paramIdx} OR (h.created_at = ?${paramIdx} AND h.id < ?${paramIdx + 1}))`);
    params.push(cursorDate, cursorId);
    paramIdx += 2;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count (without cursor for total)
  const countConditions = conditions.filter(c => !c.includes("h.created_at <") && !c.includes("h.id <"));
  const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(" AND ")}` : "";
  const countParams = options?.cursor ? params.slice(0, params.length - 2) : [...params];
  const countResult = await ctx.db
    .prepare(`SELECT COUNT(*) as count FROM highlight h ${countWhere}`)
    .bind(...countParams)
    .first<{ count: number }>();
  const total = countResult?.count ?? 0;

  // Get paginated results with document info
  const query = `
    SELECT h.*, d.id as doc_id, d.title as doc_title, d.url as doc_url, d.author as doc_author, d.type as doc_type
    FROM highlight h
    INNER JOIN document d ON d.id = h.document_id
    ${where}
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT ?${paramIdx}
  `;
  params.push(limit + 1);

  const result = await ctx.db.prepare(query).bind(...params).all<
    Highlight & { doc_id: string; doc_title: string; doc_url: string | null; doc_author: string | null; doc_type: string }
  >();

  const hasMore = result.results.length > limit;
  const rows = hasMore ? result.results.slice(0, limit) : result.results;

  const items: HighlightWithDocument[] = [];
  for (const row of rows) {
    const tags = await getTagsForHighlight(ctx.db, row.id);
    const { doc_id, doc_title, doc_url, doc_author, doc_type, ...highlight } = row;
    items.push({
      ...highlight,
      tags,
      document: {
        id: doc_id,
        title: doc_title,
        url: doc_url,
        author: doc_author,
        type: doc_type as import("@focus-reader/shared").DocumentType,
      },
    });
  }

  return {
    items,
    total,
    nextCursor: hasMore ? `${rows[rows.length - 1].created_at}|${rows[rows.length - 1].id}` : undefined,
  };
}

export async function updateHighlight(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateHighlightInput
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?${paramIdx}`);
    values.push(value);
    paramIdx++;
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = ?${paramIdx}`);
  values.push(nowISO());
  paramIdx++;

  values.push(id, ctx.userId);

  await ctx.db
    .prepare(
      `UPDATE highlight SET ${fields.join(", ")} WHERE id = ?${paramIdx} AND user_id = ?${paramIdx + 1}`
    )
    .bind(...values)
    .run();
}

export async function deleteHighlight(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  // Remove from join table first (D1 doesn't enforce FK cascades)
  await ctx.db
    .prepare("DELETE FROM highlight_tags WHERE highlight_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM highlight WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .run();
}

export async function addTagToHighlight(
  ctx: UserScopedDb,
  highlightId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "INSERT OR IGNORE INTO highlight_tags (highlight_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(highlightId, tagId)
    .run();
}

export async function removeTagFromHighlight(
  ctx: UserScopedDb,
  highlightId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "DELETE FROM highlight_tags WHERE highlight_id = ?1 AND tag_id = ?2"
    )
    .bind(highlightId, tagId)
    .run();
}

export async function getHighlightCountForDocument(
  ctx: UserScopedDb,
  documentId: string
): Promise<number> {
  const result = await ctx.db
    .prepare("SELECT COUNT(*) as count FROM highlight WHERE document_id = ?1 AND user_id = ?2")
    .bind(documentId, ctx.userId)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

async function getTagsForHighlight(
  db: D1Database,
  highlightId: string
): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN highlight_tags ht ON ht.tag_id = t.id
       WHERE ht.highlight_id = ?1`
    )
    .bind(highlightId)
    .all<Tag>();
  return result.results;
}
