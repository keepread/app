import type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
  CollectionWithCount,
  DocumentWithTags,
  Tag,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createCollection(
  ctx: UserScopedDb,
  input: CreateCollectionInput
): Promise<Collection> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  await ctx.db
    .prepare(
      `INSERT INTO collection (id, user_id, name, description, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(id, ctx.userId, input.name, input.description ?? null, now, now)
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM collection WHERE id = ?1")
    .bind(id)
    .first<Collection>())!;
}

export async function getCollection(
  ctx: UserScopedDb,
  id: string
): Promise<Collection | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM collection WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .first<Collection>();
  return result ?? null;
}

export async function listCollections(
  ctx: UserScopedDb
): Promise<CollectionWithCount[]> {
  const rows = await ctx.db
    .prepare(
      `SELECT c.*, COUNT(cd.document_id) as documentCount
       FROM collection c
       LEFT JOIN collection_documents cd ON cd.collection_id = c.id
       WHERE c.user_id = ?1
       GROUP BY c.id
       ORDER BY c.name ASC`
    )
    .bind(ctx.userId)
    .all<CollectionWithCount>();
  return rows.results;
}

export async function updateCollection(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateCollectionInput
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
      `UPDATE collection SET ${fields.join(", ")} WHERE id = ?${paramIdx} AND user_id = ?${paramIdx + 1}`
    )
    .bind(...values)
    .run();
}

export async function deleteCollection(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  await ctx.db
    .prepare("DELETE FROM collection_documents WHERE collection_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM collection WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .run();
}

export async function addDocumentToCollection(
  ctx: UserScopedDb,
  collectionId: string,
  documentId: string,
  sortOrder?: number
): Promise<void> {
  if (sortOrder === undefined) {
    const maxResult = await ctx.db
      .prepare(
        "SELECT MAX(sort_order) as max_order FROM collection_documents WHERE collection_id = ?1"
      )
      .bind(collectionId)
      .first<{ max_order: number | null }>();
    sortOrder = (maxResult?.max_order ?? -1) + 1;
  }

  await ctx.db
    .prepare(
      `INSERT OR IGNORE INTO collection_documents (collection_id, document_id, sort_order, added_at)
       VALUES (?1, ?2, ?3, ?4)`
    )
    .bind(collectionId, documentId, sortOrder, nowISO())
    .run();
}

export async function removeDocumentFromCollection(
  ctx: UserScopedDb,
  collectionId: string,
  documentId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "DELETE FROM collection_documents WHERE collection_id = ?1 AND document_id = ?2"
    )
    .bind(collectionId, documentId)
    .run();
}

export async function getCollectionDocuments(
  ctx: UserScopedDb,
  collectionId: string
): Promise<(DocumentWithTags & { sort_order: number; added_at: string })[]> {
  const rows = await ctx.db
    .prepare(
      `SELECT d.*, cd.sort_order, cd.added_at as cd_added_at
       FROM document d
       INNER JOIN collection_documents cd ON cd.document_id = d.id
       WHERE cd.collection_id = ?1
       ORDER BY cd.sort_order ASC`
    )
    .bind(collectionId)
    .all<
      import("@focus-reader/shared").Document & { sort_order: number; cd_added_at: string }
    >();

  const results: (DocumentWithTags & { sort_order: number; added_at: string })[] = [];
  for (const row of rows.results) {
    const tags = await getTagsForDoc(ctx.db, row.id);
    const { cd_added_at, ...doc } = row;
    results.push({ ...doc, tags, added_at: cd_added_at });
  }
  return results;
}

export async function reorderCollectionDocuments(
  ctx: UserScopedDb,
  collectionId: string,
  orderedDocumentIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedDocumentIds.length; i++) {
    await ctx.db
      .prepare(
        "UPDATE collection_documents SET sort_order = ?1 WHERE collection_id = ?2 AND document_id = ?3"
      )
      .bind(i, collectionId, orderedDocumentIds[i])
      .run();
  }
}

export async function getCollectionsForDocument(
  ctx: UserScopedDb,
  documentId: string
): Promise<Collection[]> {
  const result = await ctx.db
    .prepare(
      `SELECT c.* FROM collection c
       INNER JOIN collection_documents cd ON cd.collection_id = c.id
       WHERE cd.document_id = ?1 AND c.user_id = ?2`
    )
    .bind(documentId, ctx.userId)
    .all<Collection>();
  return result.results;
}

async function getTagsForDoc(db: D1Database, docId: string): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?1`
    )
    .bind(docId)
    .all<Tag>();
  return result.results;
}
