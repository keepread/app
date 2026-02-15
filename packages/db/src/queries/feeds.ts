import type {
  Feed,
  CreateFeedInput,
  FeedWithStats,
  UpdateFeedInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";

export async function createFeed(
  db: D1Database,
  input: CreateFeedInput
): Promise<Feed> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  const stmt = db.prepare(`
    INSERT INTO feed (
      id, feed_url, site_url, title, description, icon_url,
      fetch_interval_minutes, is_active, fetch_full_content,
      auto_tag_rules, error_count, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9, 0, ?10, ?10)
  `);
  await stmt
    .bind(
      id,
      input.feed_url,
      input.site_url ?? null,
      input.title,
      input.description ?? null,
      input.icon_url ?? null,
      input.fetch_interval_minutes ?? 60,
      input.fetch_full_content ?? 0,
      input.auto_tag_rules ?? null,
      now
    )
    .run();

  return (await db
    .prepare("SELECT * FROM feed WHERE id = ?1")
    .bind(id)
    .first<Feed>())!;
}

export async function getFeed(
  db: D1Database,
  id: string
): Promise<Feed | null> {
  const result = await db
    .prepare("SELECT * FROM feed WHERE id = ?1")
    .bind(id)
    .first<Feed>();
  return result ?? null;
}

export async function getFeedByUrl(
  db: D1Database,
  feedUrl: string
): Promise<Feed | null> {
  const result = await db
    .prepare("SELECT * FROM feed WHERE feed_url = ?1")
    .bind(feedUrl)
    .first<Feed>();
  return result ?? null;
}

export async function listFeeds(
  db: D1Database
): Promise<FeedWithStats[]> {
  const rows = await db
    .prepare(
      `SELECT f.*,
              COUNT(d.id) as documentCount,
              SUM(CASE WHEN d.is_read = 0 AND d.deleted_at IS NULL THEN 1 ELSE 0 END) as unreadCount
       FROM feed f
       LEFT JOIN document d ON d.source_id = f.id AND d.deleted_at IS NULL
       WHERE f.deleted_at IS NULL
       GROUP BY f.id
       ORDER BY f.title ASC`
    )
    .all<FeedWithStats>();
  return rows.results;
}

export async function updateFeed(
  db: D1Database,
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

  values.push(id);

  await db
    .prepare(
      `UPDATE feed SET ${fields.join(", ")} WHERE id = ?${paramIdx}`
    )
    .bind(...values)
    .run();
}

export async function softDeleteFeed(
  db: D1Database,
  id: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      "UPDATE feed SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2"
    )
    .bind(now, id)
    .run();
}

export async function hardDeleteFeed(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare("DELETE FROM feed_tags WHERE feed_id = ?1")
    .bind(id)
    .run();
  await db
    .prepare("DELETE FROM feed WHERE id = ?1")
    .bind(id)
    .run();
}

export async function getActiveFeeds(
  db: D1Database
): Promise<Feed[]> {
  const rows = await db
    .prepare(
      "SELECT * FROM feed WHERE is_active = 1 AND deleted_at IS NULL"
    )
    .all<Feed>();
  return rows.results;
}

export async function markFeedFetched(
  db: D1Database,
  id: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      "UPDATE feed SET last_fetched_at = ?1, error_count = 0, last_error = NULL, updated_at = ?1 WHERE id = ?2"
    )
    .bind(now, id)
    .run();
}

export async function incrementFeedError(
  db: D1Database,
  id: string,
  error: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      "UPDATE feed SET error_count = error_count + 1, last_error = ?1, updated_at = ?2 WHERE id = ?3"
    )
    .bind(error, now, id)
    .run();
}

export async function resetFeedErrors(
  db: D1Database,
  id: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      "UPDATE feed SET error_count = 0, last_error = NULL, updated_at = ?1 WHERE id = ?2"
    )
    .bind(now, id)
    .run();
}

export async function getFeedsDueForPoll(
  db: D1Database
): Promise<Feed[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM feed
       WHERE is_active = 1
         AND deleted_at IS NULL
         AND (last_fetched_at IS NULL OR last_fetched_at < datetime('now', '-' || fetch_interval_minutes || ' minutes'))`
    )
    .all<Feed>();
  return rows.results;
}
