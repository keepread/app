import type { Tag, CreateTagInput, TagWithCount, UpdateTagInput } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createTag(
  ctx: UserScopedDb,
  input: CreateTagInput
): Promise<Tag> {
  const id = crypto.randomUUID();
  const now = nowISO();
  const stmt = ctx.db.prepare(`
    INSERT INTO tag (id, user_id, name, color, description, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `);
  await stmt
    .bind(id, ctx.userId, input.name, input.color ?? null, input.description ?? null, now)
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM tag WHERE id = ?1")
    .bind(id)
    .first<Tag>())!;
}

export async function getTagsForSubscription(
  ctx: UserScopedDb,
  subscriptionId: string
): Promise<Tag[]> {
  const result = await ctx.db
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
  ctx: UserScopedDb,
  documentId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(documentId, tagId)
    .run();
}

export async function removeTagFromDocument(
  ctx: UserScopedDb,
  documentId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "DELETE FROM document_tags WHERE document_id = ?1 AND tag_id = ?2"
    )
    .bind(documentId, tagId)
    .run();
}

export async function getTagsForDocument(
  ctx: UserScopedDb,
  documentId: string
): Promise<Tag[]> {
  const result = await ctx.db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?1`
    )
    .bind(documentId)
    .all<Tag>();
  return result.results;
}

export async function listTags(ctx: UserScopedDb): Promise<TagWithCount[]> {
  const rows = await ctx.db
    .prepare(
      `SELECT t.*, COUNT(d.id) as documentCount
       FROM tag t
       LEFT JOIN document_tags dt ON dt.tag_id = t.id
       LEFT JOIN document d ON d.id = dt.document_id AND d.deleted_at IS NULL
       WHERE t.user_id = ?1
       GROUP BY t.id
       ORDER BY t.name ASC`
    )
    .bind(ctx.userId)
    .all<TagWithCount>();
  return rows.results;
}

export async function getTag(
  ctx: UserScopedDb,
  id: string
): Promise<Tag | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM tag WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .first<Tag>();
  return result ?? null;
}

export async function updateTag(
  ctx: UserScopedDb,
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

  values.push(id, ctx.userId);

  await ctx.db
    .prepare(
      `UPDATE tag SET ${fields.join(", ")} WHERE id = ?${paramIdx} AND user_id = ?${paramIdx + 1}`
    )
    .bind(...values)
    .run();
}

export async function deleteTag(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  // Remove from all join tables first (D1 doesn't enforce FK cascades)
  await ctx.db
    .prepare("DELETE FROM document_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM subscription_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM feed_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM highlight_tags WHERE tag_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM tag WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .run();
}

export async function addTagToSubscription(
  ctx: UserScopedDb,
  subscriptionId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "INSERT OR IGNORE INTO subscription_tags (subscription_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(subscriptionId, tagId)
    .run();
}

export async function removeTagFromSubscription(
  ctx: UserScopedDb,
  subscriptionId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "DELETE FROM subscription_tags WHERE subscription_id = ?1 AND tag_id = ?2"
    )
    .bind(subscriptionId, tagId)
    .run();
}

export async function addTagToFeed(
  ctx: UserScopedDb,
  feedId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "INSERT OR IGNORE INTO feed_tags (feed_id, tag_id) VALUES (?1, ?2)"
    )
    .bind(feedId, tagId)
    .run();
}

export async function removeTagFromFeed(
  ctx: UserScopedDb,
  feedId: string,
  tagId: string
): Promise<void> {
  await ctx.db
    .prepare(
      "DELETE FROM feed_tags WHERE feed_id = ?1 AND tag_id = ?2"
    )
    .bind(feedId, tagId)
    .run();
}

export async function getTagsForFeed(
  ctx: UserScopedDb,
  feedId: string
): Promise<Tag[]> {
  const result = await ctx.db
    .prepare(
      `SELECT t.* FROM tag t
       INNER JOIN feed_tags ft ON ft.tag_id = t.id
       WHERE ft.feed_id = ?1`
    )
    .bind(feedId)
    .all<Tag>();
  return result.results;
}
