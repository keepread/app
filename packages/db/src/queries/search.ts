import type { DocumentLocation, DocumentType } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export interface SearchResult {
  documentId: string;
  snippet: string;
  rank: number;
}

/**
 * Sanitize user input for FTS5 MATCH queries.
 * Wraps each word in double quotes to prevent FTS5 syntax errors.
 */
export function sanitizeFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => `"${word.replace(/"/g, "")}"`)
    .join(" ");
}

export async function searchDocuments(
  ctx: UserScopedDb,
  query: string,
  options?: { limit?: number; offset?: number; location?: DocumentLocation; type?: DocumentType; tagId?: string }
): Promise<{ results: SearchResult[]; total: number }> {
  const sanitized = sanitizeFtsQuery(query);
  if (!sanitized) {
    return { results: [], total: 0 };
  }

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const conditions: string[] = ["d.deleted_at IS NULL", "d.user_id = ?2"];
  const bindings: unknown[] = [sanitized, ctx.userId];
  let paramIdx = 3;

  if (options?.location) {
    conditions.push(`d.location = ?${paramIdx}`);
    bindings.push(options.location);
    paramIdx++;
  }
  if (options?.type) {
    conditions.push(`d.type = ?${paramIdx}`);
    bindings.push(options.type);
    paramIdx++;
  }
  if (options?.tagId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM document_tags dt WHERE dt.document_id = d.id AND dt.tag_id = ?${paramIdx})`
    );
    bindings.push(options.tagId);
    paramIdx++;
  }

  const where = conditions.join(" AND ");

  // Count query
  const countResult = await ctx.db
    .prepare(
      `SELECT COUNT(*) as cnt FROM document_fts fts
       INNER JOIN document d ON d.id = fts.doc_id
       WHERE document_fts MATCH ?1 AND ${where}`
    )
    .bind(...bindings)
    .first<{ cnt: number }>();
  const total = countResult?.cnt ?? 0;

  // Results query with snippet
  bindings.push(limit, offset);
  const rows = await ctx.db
    .prepare(
      `SELECT fts.doc_id as documentId,
              snippet(document_fts, 3, '<mark>', '</mark>', '…', 40) as snippet,
              rank
       FROM document_fts fts
       INNER JOIN document d ON d.id = fts.doc_id
       WHERE document_fts MATCH ?1 AND ${where}
       ORDER BY rank
       LIMIT ?${paramIdx} OFFSET ?${paramIdx + 1}`
    )
    .bind(...bindings)
    .all<SearchResult>();

  return { results: rows.results, total };
}

export async function indexDocument(
  db: D1Database,
  doc: {
    id: string;
    title: string;
    author: string | null;
    plain_text_content: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO document_fts(doc_id, title, author, plain_text_content)
       VALUES (?1, ?2, COALESCE(?3, ''), COALESCE(?4, ''))`
    )
    .bind(doc.id, doc.title, doc.author, doc.plain_text_content)
    .run();
}

export async function deindexDocument(
  db: D1Database,
  docId: string
): Promise<void> {
  await db
    .prepare("DELETE FROM document_fts WHERE doc_id = ?1")
    .bind(docId)
    .run();
}

export async function rebuildSearchIndex(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM document_fts").run();
  await db
    .prepare(
      `INSERT INTO document_fts(doc_id, title, author, plain_text_content)
       SELECT id, title, COALESCE(author, ''), COALESCE(plain_text_content, '')
       FROM document WHERE deleted_at IS NULL`
    )
    .run();
}
