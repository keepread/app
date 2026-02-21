import type {
  Document,
  DocumentType,
  CreateDocumentInput,
  ListDocumentsQuery,
  DocumentWithTags,
  Tag,
} from "@focus-reader/shared";
import { nowISO, DEFAULT_PAGE_SIZE } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";
import { indexDocument, deindexDocument, sanitizeFtsQuery } from "./search.js";
import { getEmailMetaByDocumentId } from "./email-meta.js";

export async function createDocument(
  ctx: UserScopedDb,
  input: CreateDocumentInput
): Promise<Document> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  const stmt = ctx.db.prepare(`
    INSERT INTO document (
      id, user_id, type, url, title, author, author_url, site_name, excerpt,
      word_count, reading_time_minutes, cover_image_url, favicon_url,
      html_content, markdown_content, plain_text_content,
      location, is_read, is_starred, reading_progress,
      saved_at, published_at, lang, updated_at, source_id, origin_type
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
      ?10, ?11, ?12, ?22,
      ?13, ?14, ?15,
      ?16, 0, 0, 0.0,
      ?17, ?18, ?19, ?17, ?20, ?21
    )
  `);
  await stmt
    .bind(
      id,
      ctx.userId,
      input.type,
      input.url ?? null,
      input.title,
      input.author ?? null,
      input.author_url ?? null,
      input.site_name ?? null,
      input.excerpt ?? null,
      input.word_count ?? 0,
      input.reading_time_minutes ?? 0,
      input.cover_image_url ?? null,
      input.html_content ?? null,
      input.markdown_content ?? null,
      input.plain_text_content ?? null,
      input.location ?? "inbox",
      now,
      input.published_at ?? null,
      input.lang ?? null,
      input.source_id ?? null,
      input.origin_type,
      input.favicon_url ?? null
    )
    .run();

  const doc = (await getDocument(ctx, id))!;

  try {
    await indexDocument(ctx.db, {
      id: doc.id,
      title: doc.title,
      author: doc.author,
      plain_text_content: doc.plain_text_content,
    });
  } catch {
    // FTS table may not exist in some environments; document is still created
  }

  return doc;
}

export async function getDocument(
  ctx: UserScopedDb,
  id: string
): Promise<Document | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM document WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .first<Document>();
  return result ?? null;
}

export async function updateDocument(
  ctx: UserScopedDb,
  id: string,
  updates: Partial<Pick<Document, "updated_at" | "location" | "is_read" | "is_starred" | "reading_progress" | "last_read_at" | "deleted_at">>
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  if (fields.length === 0) return;

  // Always update updated_at
  if (!updates.updated_at) {
    fields.push(`updated_at = ?${paramIndex}`);
    values.push(nowISO());
    paramIndex++;
  }

  values.push(id, ctx.userId);

  await ctx.db
    .prepare(
      `UPDATE document SET ${fields.join(", ")} WHERE id = ?${paramIndex} AND user_id = ?${paramIndex + 1}`
    )
    .bind(...values)
    .run();
}

export interface EnrichDocumentInput {
  title?: string;
  html_content?: string | null;
  markdown_content?: string | null;
  plain_text_content?: string | null;
  excerpt?: string | null;
  author?: string | null;
  site_name?: string | null;
  cover_image_url?: string | null;
  cover_image_r2_key?: string | null;
  word_count?: number;
  reading_time_minutes?: number;
  lang?: string | null;
}

export async function enrichDocument(
  ctx: UserScopedDb,
  id: string,
  updates: EnrichDocumentInput
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = ?${paramIndex}`);
  values.push(nowISO());
  paramIndex++;

  values.push(id, ctx.userId);

  await ctx.db
    .prepare(
      `UPDATE document SET ${fields.join(", ")} WHERE id = ?${paramIndex} AND user_id = ?${paramIndex + 1}`
    )
    .bind(...values)
    .run();

  // Reindex FTS if text fields changed
  if (updates.title !== undefined || updates.author !== undefined || updates.plain_text_content !== undefined) {
    try {
      await deindexDocument(ctx.db, id);
      const doc = await ctx.db
        .prepare("SELECT id, title, author, plain_text_content FROM document WHERE id = ?1 AND user_id = ?2")
        .bind(id, ctx.userId)
        .first<{ id: string; title: string; author: string | null; plain_text_content: string | null }>();
      if (doc) {
        await indexDocument(ctx.db, doc);
      }
    } catch {
      // FTS reindex failure is non-fatal
    }
  }
}

export async function getDocumentByUrl(
  ctx: UserScopedDb,
  url: string
): Promise<Document | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM document WHERE url = ?1 AND user_id = ?2 AND deleted_at IS NULL")
    .bind(url, ctx.userId)
    .first<Document>();
  return result ?? null;
}

export async function listDocuments(
  ctx: UserScopedDb,
  query: ListDocumentsQuery
): Promise<{ items: Document[]; total: number; nextCursor?: string }> {
  const conditions: string[] = ["d.deleted_at IS NULL", "d.user_id = ?1"];
  const bindings: unknown[] = [ctx.userId];
  let paramIdx = 2;

  if (query.location) {
    conditions.push(`d.location = ?${paramIdx}`);
    bindings.push(query.location);
    paramIdx++;
  }
  if (query.status === "read") {
    conditions.push("d.is_read = 1");
  } else if (query.status === "unread") {
    conditions.push("d.is_read = 0");
  }
  if (query.isStarred) {
    conditions.push("d.is_starred = 1");
  }
  if (query.subscriptionId) {
    conditions.push(`d.source_id = ?${paramIdx}`);
    bindings.push(query.subscriptionId);
    paramIdx++;
  }
  if (query.feedId) {
    conditions.push(`d.source_id = ?${paramIdx}`);
    bindings.push(query.feedId);
    paramIdx++;
  }
  if (query.type) {
    conditions.push(`d.type = ?${paramIdx}`);
    bindings.push(query.type);
    paramIdx++;
  }
  if (query.tagId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM document_tags dt WHERE dt.document_id = d.id AND dt.tag_id = ?${paramIdx})`
    );
    bindings.push(query.tagId);
    paramIdx++;
  }
  if (query.search) {
    conditions.push(
      `d.id IN (SELECT doc_id FROM document_fts WHERE document_fts MATCH ?${paramIdx})`
    );
    bindings.push(sanitizeFtsQuery(query.search));
    paramIdx++;
  }
  if (query.savedAfter) {
    conditions.push(`d.saved_at >= ?${paramIdx}`);
    bindings.push(query.savedAfter);
    paramIdx++;
  }
  if (query.savedBefore) {
    conditions.push(`d.saved_at <= ?${paramIdx}`);
    bindings.push(query.savedBefore);
    paramIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count query
  const countResult = await ctx.db
    .prepare(`SELECT COUNT(*) as cnt FROM document d ${where}`)
    .bind(...bindings)
    .first<{ cnt: number }>();
  const total = countResult?.cnt ?? 0;

  // Cursor-based pagination
  const sortBy = query.sortBy ?? "saved_at";
  const sortDir = query.sortDir ?? "desc";
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;

  const cursorConditions = [...conditions];
  const cursorBindings = [...bindings];

  if (query.cursor) {
    const op = sortDir === "desc" ? "<" : ">";
    cursorConditions.push(`d.${sortBy} ${op} ?${paramIdx}`);
    cursorBindings.push(query.cursor);
    paramIdx++;
  }

  const cursorWhere =
    cursorConditions.length > 0
      ? `WHERE ${cursorConditions.join(" AND ")}`
      : "";

  const sqlDir = sortDir === "desc" ? "DESC" : "ASC";
  const rows = await ctx.db
    .prepare(
      `SELECT d.* FROM document d ${cursorWhere} ORDER BY d.${sortBy} ${sqlDir} LIMIT ?${paramIdx}`
    )
    .bind(...cursorBindings, limit + 1)
    .all<Document>();

  const items = rows.results.slice(0, limit);
  const hasMore = rows.results.length > limit;
  const nextCursor = hasMore ? (items[items.length - 1] as any)[sortBy] : undefined;

  return { items, total, nextCursor };
}

export async function getDocumentWithTags(
  ctx: UserScopedDb,
  id: string
): Promise<DocumentWithTags | null> {
  const doc = await getDocument(ctx, id);
  if (!doc) return null;

  const tagRows = await ctx.db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?1`
    )
    .bind(id)
    .all<Tag>();

  const subscription = doc.source_id
    ? await ctx.db
        .prepare("SELECT * FROM subscription WHERE id = ?1 AND user_id = ?2")
        .bind(doc.source_id, ctx.userId)
        .first()
    : undefined;

  const emailMeta = doc.type === "email"
    ? await getEmailMetaByDocumentId(ctx.db, id)
    : undefined;

  return {
    ...doc,
    tags: tagRows.results,
    subscription: subscription ?? undefined,
    emailMeta: emailMeta ?? undefined,
  } as DocumentWithTags;
}

export async function softDeleteDocument(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare("UPDATE document SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3")
    .bind(now, id, ctx.userId)
    .run();
  try {
    await deindexDocument(ctx.db, id);
  } catch {
    // FTS table may not exist in some environments; soft-delete still succeeds
  }
}

export async function updateReadingProgress(
  ctx: UserScopedDb,
  id: string,
  progress: number,
  scrollPosition?: number
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      `UPDATE document SET reading_progress = ?1, last_read_at = ?2, updated_at = ?2 WHERE id = ?3 AND user_id = ?4`
    )
    .bind(progress, now, id, ctx.userId)
    .run();
}

export async function getDocumentCount(
  ctx: UserScopedDb,
  filters: { location?: string; isStarred?: boolean; isRead?: boolean }
): Promise<number> {
  const conditions: string[] = ["deleted_at IS NULL", "user_id = ?1"];
  const bindings: unknown[] = [ctx.userId];
  let paramIdx = 2;

  if (filters.location) {
    conditions.push(`location = ?${paramIdx}`);
    bindings.push(filters.location);
    paramIdx++;
  }
  if (filters.isStarred) {
    conditions.push("is_starred = 1");
  }
  if (filters.isRead === false) {
    conditions.push("is_read = 0");
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const result = await ctx.db
    .prepare(`SELECT COUNT(*) as cnt FROM document ${where}`)
    .bind(...bindings)
    .first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

export interface DocumentCoverInfo {
  id: string;
  cover_image_url: string | null;
  cover_image_r2_key: string | null;
}

export async function getDocumentCoverInfo(
  ctx: UserScopedDb,
  id: string
): Promise<DocumentCoverInfo | null> {
  const result = await ctx.db
    .prepare(
      "SELECT id, cover_image_url, cover_image_r2_key FROM document WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
    )
    .bind(id, ctx.userId)
    .first<DocumentCoverInfo>();
  return result ?? null;
}

export async function batchUpdateDocuments(
  ctx: UserScopedDb,
  ids: string[],
  updates: Partial<Pick<Document, "location" | "is_read" | "is_starred">>
): Promise<void> {
  if (ids.length === 0) return;
  const now = nowISO();
  const fields: string[] = ["updated_at = ?1"];
  const values: unknown[] = [now];
  let paramIdx = 2;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?${paramIdx}`);
    values.push(value);
    paramIdx++;
  }

  // user_id param
  values.push(ctx.userId);
  const userIdParam = paramIdx;
  paramIdx++;

  const placeholders = ids.map((_, i) => `?${paramIdx + i}`).join(", ");

  await ctx.db
    .prepare(
      `UPDATE document SET ${fields.join(", ")} WHERE user_id = ?${userIdParam} AND id IN (${placeholders})`
    )
    .bind(...values, ...ids)
    .run();
}
