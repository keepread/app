/**
 * Admin / worker-level queries that operate on raw D1Database.
 * These are NOT user-scoped — they return data across all users
 * and are used by system-level workers (RSS polling, etc).
 */
import type { Feed, User } from "@focus-reader/shared";

export async function getAllFeedsDueForPoll(
  db: D1Database
): Promise<Feed[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM feed
       WHERE is_active = 1
         AND deleted_at IS NULL
         AND (last_fetched_at IS NULL OR datetime(last_fetched_at) < datetime('now', '-' || fetch_interval_minutes || ' minutes'))`
    )
    .all<Feed>();
  return rows.results;
}

export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM user WHERE email = ?1")
    .bind(email)
    .first<User>();
  return result ?? null;
}

export async function getUserBySlug(
  db: D1Database,
  slug: string
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM user WHERE slug = ?1")
    .bind(slug)
    .first<User>();
  return result ?? null;
}

export async function getUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM user WHERE id = ?1")
    .bind(id)
    .first<User>();
  return result ?? null;
}

export async function getOrCreateSingleUser(
  db: D1Database,
  email: string
): Promise<User> {
  // In single-user mode (no CF Access), find or create the sole user.
  // This should ONLY be called from the auto-auth fallback (no CF Access configured).
  const existing = await db
    .prepare("SELECT * FROM user LIMIT 1")
    .first<User>();
  if (existing) {
    return existing;
  }
  return createUserByEmail(db, email, true);
}

export async function createUserByEmail(
  db: D1Database,
  email: string,
  isAdmin = false
): Promise<User> {
  // Check if user already exists for this email
  const existing = await db
    .prepare("SELECT * FROM user WHERE email = ?1")
    .bind(email)
    .first<User>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);
  await db
    .prepare(
      `INSERT INTO user (id, email, slug, is_admin, is_active)
       VALUES (?1, ?2, ?3, ?4, 1)`
    )
    .bind(id, email, slug, isAdmin ? 1 : 0)
    .run();
  return (await db
    .prepare("SELECT * FROM user WHERE id = ?1")
    .bind(id)
    .first<User>())!;
}

export async function getApiKeyByHashAdmin(
  db: D1Database,
  keyHash: string
): Promise<{ user_id: string; id: string } | null> {
  const result = await db
    .prepare("SELECT id, user_id FROM api_key WHERE key_hash = ?1 AND revoked_at IS NULL")
    .bind(keyHash)
    .first<{ id: string; user_id: string }>();
  if (!result) return null;
  await db
    .prepare("UPDATE api_key SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1")
    .bind(result.id)
    .run();
  return result;
}
