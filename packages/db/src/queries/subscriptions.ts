import type {
  Subscription,
  CreateSubscriptionInput,
  SubscriptionWithStats,
  UpdateSubscriptionInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";

export async function createSubscription(
  db: D1Database,
  input: CreateSubscriptionInput
): Promise<Subscription> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  const stmt = db.prepare(`
    INSERT INTO subscription (
      id, pseudo_email, display_name, sender_address, sender_name,
      is_active, auto_tag_rules, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
  `);
  await stmt
    .bind(
      id,
      input.pseudo_email,
      input.display_name,
      input.sender_address ?? null,
      input.sender_name ?? null,
      input.is_active ?? 1,
      input.auto_tag_rules ?? null,
      now
    )
    .run();

  return (await db
    .prepare("SELECT * FROM subscription WHERE id = ?1")
    .bind(id)
    .first<Subscription>())!;
}

export async function getSubscriptionByEmail(
  db: D1Database,
  pseudoEmail: string
): Promise<Subscription | null> {
  const result = await db
    .prepare("SELECT * FROM subscription WHERE pseudo_email = ?1")
    .bind(pseudoEmail)
    .first<Subscription>();
  return result ?? null;
}

export async function getSubscription(
  db: D1Database,
  id: string
): Promise<Subscription | null> {
  const result = await db
    .prepare("SELECT * FROM subscription WHERE id = ?1")
    .bind(id)
    .first<Subscription>();
  return result ?? null;
}

export async function listSubscriptions(
  db: D1Database
): Promise<SubscriptionWithStats[]> {
  const rows = await db
    .prepare(
      `SELECT s.*,
              COUNT(d.id) as documentCount,
              SUM(CASE WHEN d.is_read = 0 AND d.deleted_at IS NULL THEN 1 ELSE 0 END) as unreadCount
       FROM subscription s
       LEFT JOIN document d ON d.source_id = s.id AND d.deleted_at IS NULL
       WHERE s.deleted_at IS NULL
       GROUP BY s.id
       ORDER BY s.display_name ASC`
    )
    .all<SubscriptionWithStats>();
  return rows.results;
}

export async function updateSubscription(
  db: D1Database,
  id: string,
  updates: UpdateSubscriptionInput
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
      `UPDATE subscription SET ${fields.join(", ")} WHERE id = ?${paramIdx}`
    )
    .bind(...values)
    .run();
}

export async function softDeleteSubscription(
  db: D1Database,
  id: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      "UPDATE subscription SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2"
    )
    .bind(now, id)
    .run();
}

export async function getSubscriptionStats(
  db: D1Database,
  id: string
): Promise<{ unreadCount: number; latestDocumentDate: string | null }> {
  const result = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unreadCount,
        MAX(saved_at) as latestDocumentDate
       FROM document
       WHERE source_id = ?1 AND deleted_at IS NULL`
    )
    .bind(id)
    .first<{ unreadCount: number; latestDocumentDate: string | null }>();
  return {
    unreadCount: result?.unreadCount ?? 0,
    latestDocumentDate: result?.latestDocumentDate ?? null,
  };
}
