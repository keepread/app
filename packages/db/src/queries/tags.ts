import type { Tag, CreateTagInput, TagWithCount, UpdateTagInput } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";

export async function createTag(
  db: D1Database,
  input: CreateTagInput
): Promise<Tag> {
  const id = crypto.randomUUID();
  const now = nowISO();
  const stmt = db.prepare(`
    INSERT INTO tag (id, name, color, description, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `);
  await stmt
    .bind(id, input.name, input.color ?? null, input.description ?? null, now)
    .run();

  return (await db
    .prepare("SELECT * FROM tag WHERE id = ?1")
    .bind(id)
    .first<Tag>())!;
}

export async function getTagsForSubscription(
  db: D1Database,
  subscriptionId: string
): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN subscription_tags st ON st.tag_id = t.id
       WHERE st.subscription_id = ?1`
    )
    .bind(subscriptionId)
    .all<Tag>();
  return result.results;
}

export async function addTagToDocument(
  db: D1Database,
  documentId: string,
  tagId: string
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(documentId, tagId)
    .run();
}

export async function removeTagFromDocument(
  db: D1Database,
  documentId: string,
  tagId: string
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM document_tags WHERE document_id = ?1 AND tag_id = ?2"
    )
    .bind(documentId, tagId)
    .run();
}

export async function getTagsForDocument(
  db: D1Database,
  documentId: string
): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?1`
    )
    .bind(documentId)
    .all<Tag>();
  return result.results;
}

export async function listTags(db: D1Database): Promise<TagWithCount[]> {
  const rows = await db
    .prepare(
      `SELECT t.*, COUNT(dt.document_id) as documentCount
       FROM tag t
       LEFT JOIN document_tags dt ON dt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name ASC`
    )
    .all<TagWithCount>();
  return rows.results;
}

export async function getTag(
  db: D1Database,
  id: string
): Promise<Tag | null> {
  const result = await db
    .prepare("SELECT * FROM tag WHERE id = ?1")
    .bind(id)
    .first<Tag>();
  return result ?? null;
}

export async function updateTag(
  db: D1Database,
  id: string,
  updates: UpdateTagInput
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

  values.push(id);

  await db
    .prepare(
      `UPDATE tag SET ${fields.join(", ")} WHERE id = ?${paramIdx}`
    )
    .bind(...values)
    .run();
}

export async function deleteTag(
  db: D1Database,
  id: string
): Promise<void> {
  // Remove from all join tables first (D1 doesn't enforce FK cascades)
  await db
    .prepare("DELETE FROM document_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await db
    .prepare("DELETE FROM subscription_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await db
    .prepare("DELETE FROM feed_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await db
    .prepare("DELETE FROM tag WHERE id = ?1")
    .bind(id)
    .run();
}

export async function addTagToSubscription(
  db: D1Database,
  subscriptionId: string,
  tagId: string
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO subscription_tags (subscription_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(subscriptionId, tagId)
    .run();
}

export async function removeTagFromSubscription(
  db: D1Database,
  subscriptionId: string,
  tagId: string
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM subscription_tags WHERE subscription_id = ?1 AND tag_id = ?2"
    )
    .bind(subscriptionId, tagId)
    .run();
}

export async function addTagToFeed(
  db: D1Database,
  feedId: string,
  tagId: string
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO feed_tags (feed_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(feedId, tagId)
    .run();
}

export async function removeTagFromFeed(
  db: D1Database,
  feedId: string,
  tagId: string
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM feed_tags WHERE feed_id = ?1 AND tag_id = ?2"
    )
    .bind(feedId, tagId)
    .run();
}

export async function getTagsForFeed(
  db: D1Database,
  feedId: string
): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN feed_tags ft ON ft.tag_id = t.id
       WHERE ft.feed_id = ?1`
    )
    .bind(feedId)
    .all<Tag>();
  return result.results;
}
