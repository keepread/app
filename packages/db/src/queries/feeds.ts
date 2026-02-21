import type {
  Feed,
  CreateFeedInput,
  FeedWithStats,
  UpdateFeedInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createFeed(
  ctx: UserScopedDb,
  input: CreateFeedInput
): Promise<Feed> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  const stmt = ctx.db.prepare(`
    INSERT INTO feed (
      id, user_id, feed_url, site_url, title, description, icon_url,
      fetch_interval_minutes, is_active, fetch_full_content,
      auto_tag_rules, error_count, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, 0, ?11, ?11)
  `);
  await stmt
    .bind(
      id,
      ctx.userId,
      input.feed_url,
      input.site_url ?? null,
      input.title,
      input.description ?? null,
      input.icon_url ?? null,
      input.fetch_interval_minutes ?? 60,
      input.fetch_full_content ?? 1,
      input.auto_tag_rules ?? null,
      now
    )
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM feed WHERE id = ?1")
    .bind(id)
    .first<Feed>())!;
}

export async function getFeed(
  ctx: UserScopedDb,
  id: string
): Promise<Feed | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM feed WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .first<Feed>();
  return result ?? null;
}

export async function getFeedByUrl(
  ctx: UserScopedDb,
  feedUrl: string
): Promise<Feed | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM feed WHERE feed_url = ?1 AND user_id = ?2 AND deleted_at IS NULL")
    .bind(feedUrl, ctx.userId)
    .first<Feed>();
  return result ?? null;
}

export async function getFeedByUrlIncludeDeleted(
  ctx: UserScopedDb,
  feedUrl: string
): Promise<Feed | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM feed WHERE feed_url = ?1 AND user_id = ?2")
    .bind(feedUrl, ctx.userId)
    .first<Feed>();
  return result ?? null;
}

export async function restoreFeed(
  ctx: UserScopedDb,
  id: string
): Promise<Feed> {
  const now = nowISO();
  await ctx.db
    .prepare(
      "UPDATE feed SET deleted_at = NULL, is_active = 1, error_count = 0, last_error = NULL, updated_at = ?1 WHERE id = ?2 AND user_id = ?3"
    )
    .bind(now, id, ctx.userId)
    .run();
  return (await ctx.db
    .prepare("SELECT * FROM feed WHERE id = ?1")
    .bind(id)
    .first<Feed>())!;
}

export async function listFeeds(
  ctx: UserScopedDb
): Promise<FeedWithStats[]> {
  const rows = await ctx.db
    .prepare(
      `SELECT f.*,
              COUNT(d.id) as documentCount,
              SUM(CASE WHEN d.is_read = 0 AND d.deleted_at IS NULL THEN 1 ELSE 0 END) as unreadCount
       FROM feed f
       LEFT JOIN document d ON d.source_id = f.id AND d.deleted_at IS NULL
       WHERE f.deleted_at IS NULL AND f.user_id = ?1
       GROUP BY f.id
       ORDER BY f.title ASC`
    )
    .bind(ctx.userId)
    .all<FeedWithStats>();
  return rows.results;
}

export async function updateFeed(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateFeedInput
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
      `UPDATE feed SET ${fields.join(", ")} WHERE id = ?${paramIdx} AND user_id = ?${paramIdx + 1}`
    )
    .bind(...values)
    .run();
}

export async function softDeleteFeed(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      "UPDATE feed SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3"
    )
    .bind(now, id, ctx.userId)
    .run();
}

export async function hardDeleteFeed(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  await ctx.db
    .prepare("DELETE FROM feed_tags WHERE feed_id = ?1")
    .bind(id)
    .run();
  await ctx.db
    .prepare("DELETE FROM feed WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .run();
}

export async function getActiveFeeds(
  ctx: UserScopedDb
): Promise<Feed[]> {
  const rows = await ctx.db
    .prepare(
      "SELECT * FROM feed WHERE is_active = 1 AND deleted_at IS NULL AND user_id = ?1"
    )
    .bind(ctx.userId)
    .all<Feed>();
  return rows.results;
}

export async function markFeedFetched(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      "UPDATE feed SET last_fetched_at = ?1, error_count = 0, last_error = NULL, updated_at = ?1 WHERE id = ?2 AND user_id = ?3"
    )
    .bind(now, id, ctx.userId)
    .run();
}

export async function incrementFeedError(
  ctx: UserScopedDb,
  id: string,
  error: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      "UPDATE feed SET error_count = error_count + 1, last_error = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4"
    )
    .bind(error, now, id, ctx.userId)
    .run();
}

export async function resetFeedErrors(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      "UPDATE feed SET error_count = 0, last_error = NULL, updated_at = ?1 WHERE id = ?2 AND user_id = ?3"
    )
    .bind(now, id, ctx.userId)
    .run();
}

export async function getFeedsDueForPoll(
  ctx: UserScopedDb
): Promise<Feed[]> {
  const rows = await ctx.db
    .prepare(
      `SELECT * FROM feed
       WHERE is_active = 1
         AND deleted_at IS NULL
         AND user_id = ?1
         AND (last_fetched_at IS NULL OR datetime(last_fetched_at) < datetime('now', '-' || fetch_interval_minutes || ' minutes'))`
    )
    .bind(ctx.userId)
    .all<Feed>();
  return rows.results;
}
