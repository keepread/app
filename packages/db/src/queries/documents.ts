import type {
  Document,
  CreateDocumentInput,
  ListDocumentsQuery,
  DocumentWithTags,
  Tag,
} from "@focus-reader/shared";
import { nowISO, DEFAULT_PAGE_SIZE } from "@focus-reader/shared";

export async function createDocument(
  db: D1Database,
  input: CreateDocumentInput
): Promise<Document> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  const stmt = db.prepare(`
    INSERT INTO document (
      id, type, url, title, author, author_url, site_name, excerpt,
      word_count, reading_time_minutes, cover_image_url,
      html_content, markdown_content, plain_text_content,
      location, is_read, is_starred, reading_progress,
      saved_at, published_at, updated_at, source_id, origin_type
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
      ?9, ?10, ?11,
      ?12, ?13, ?14,
      ?15, 0, 0, 0.0,
      ?16, ?17, ?16, ?18, ?19
    )
  `);
  await stmt
    .bind(
      id,
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
      input.source_id ?? null,
      input.origin_type
    )
    .run();

  return (await getDocument(db, id))!;
}

export async function getDocument(
  db: D1Database,
  id: string
): Promise<Document | null> {
  const result = await db
    .prepare("SELECT * FROM document WHERE id = ?1")
    .bind(id)
    .first<Document>();
  return result ?? null;
}

export async function updateDocument(
  db: D1Database,
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

  values.push(id);

  await db
    .prepare(
      `UPDATE document SET ${fields.join(", ")} WHERE id = ?${paramIndex}`
    )
    .bind(...values)
    .run();
}

export async function getDocumentByUrl(
  db: D1Database,
  url: string
): Promise<Document | null> {
  const result = await db
    .prepare("SELECT * FROM document WHERE url = ?1")
    .bind(url)
    .first<Document>();
  return result ?? null;
}

export async function listDocuments(
  db: D1Database,
  query: ListDocumentsQuery
): Promise<{ items: Document[]; total: number; nextCursor?: string }> {
  const conditions: string[] = ["d.deleted_at IS NULL"];
  const bindings: unknown[] = [];
  let paramIdx = 1;

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
  if (query.tagId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM document_tags dt WHERE dt.document_id = d.id AND dt.tag_id = ?${paramIdx})`
    );
    bindings.push(query.tagId);
    paramIdx++;
  }
  if (query.search) {
    conditions.push(`d.title LIKE ?${paramIdx}`);
    bindings.push(`%${query.search}%`);
    paramIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count query
  const countResult = await db
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
  const rows = await db
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
  db: D1Database,
  id: string
): Promise<DocumentWithTags | null> {
  const doc = await getDocument(db, id);
  if (!doc) return null;

  const tagRows = await db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?1`
    )
    .bind(id)
    .all<Tag>();

  const subscription = doc.source_id
    ? await db
        .prepare("SELECT * FROM subscription WHERE id = ?1")
        .bind(doc.source_id)
        .first()
    : undefined;

  return {
    ...doc,
    tags: tagRows.results,
    subscription: subscription ?? undefined,
  } as DocumentWithTags;
}

export async function softDeleteDocument(
  db: D1Database,
  id: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare("UPDATE document SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
}

export async function updateReadingProgress(
  db: D1Database,
  id: string,
  progress: number,
  scrollPosition?: number
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      `UPDATE document SET reading_progress = ?1, last_read_at = ?2, updated_at = ?2 WHERE id = ?3`
    )
    .bind(progress, now, id)
    .run();
}

export async function getDocumentCount(
  db: D1Database,
  filters: { location?: string; isStarred?: boolean; isRead?: boolean }
): Promise<number> {
  const conditions: string[] = ["deleted_at IS NULL"];
  const bindings: unknown[] = [];
  let paramIdx = 1;

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
  const result = await db
    .prepare(`SELECT COUNT(*) as cnt FROM document ${where}`)
    .bind(...bindings)
    .first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

export async function batchUpdateDocuments(
  db: D1Database,
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

  const placeholders = ids.map((_, i) => `?${paramIdx + i}`).join(", ");

  await db
    .prepare(
      `UPDATE document SET ${fields.join(", ")} WHERE id IN (${placeholders})`
    )
    .bind(...values, ...ids)
    .run();
}
