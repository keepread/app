import type {
  Subscription,
  CreateSubscriptionInput,
  SubscriptionWithStats,
  UpdateSubscriptionInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createSubscription(
  ctx: UserScopedDb,
  input: CreateSubscriptionInput
): Promise<Subscription> {
  const id = input.id ?? crypto.randomUUID();
  const now = nowISO();
  const stmt = ctx.db.prepare(`
    INSERT INTO subscription (
      id, user_id, pseudo_email, display_name, sender_address, sender_name,
      is_active, auto_tag_rules, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
  `);
  await stmt
    .bind(
      id,
      ctx.userId,
      input.pseudo_email,
      input.display_name,
      input.sender_address ?? null,
      input.sender_name ?? null,
      input.is_active ?? 1,
      input.auto_tag_rules ?? null,
      now
    )
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM subscription WHERE id = ?1")
    .bind(id)
    .first<Subscription>())!;
}

export async function getSubscriptionByEmail(
  ctx: UserScopedDb,
  pseudoEmail: string
): Promise<Subscription | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM subscription WHERE pseudo_email = ?1 AND user_id = ?2")
    .bind(pseudoEmail, ctx.userId)
    .first<Subscription>();
  return result ?? null;
}

export async function getSubscription(
  ctx: UserScopedDb,
  id: string
): Promise<Subscription | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM subscription WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .first<Subscription>();
  return result ?? null;
}

export async function listSubscriptions(
  ctx: UserScopedDb
): Promise<SubscriptionWithStats[]> {
  const rows = await ctx.db
    .prepare(
      `SELECT s.*,
              COUNT(d.id) as documentCount,
              SUM(CASE WHEN d.is_read = 0 AND d.deleted_at IS NULL THEN 1 ELSE 0 END) as unreadCount
       FROM subscription s
       LEFT JOIN document d ON d.source_id = s.id AND d.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND s.user_id = ?1
       GROUP BY s.id
       ORDER BY s.display_name ASC`
    )
    .bind(ctx.userId)
    .all<SubscriptionWithStats>();
  return rows.results;
}

export async function updateSubscription(
  ctx: UserScopedDb,
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

  values.push(id, ctx.userId);

  await ctx.db
    .prepare(
      `UPDATE subscription SET ${fields.join(", ")} WHERE id = ?${paramIdx} AND user_id = ?${paramIdx + 1}`
    )
    .bind(...values)
    .run();
}

export async function softDeleteSubscription(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      "UPDATE subscription SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3"
    )
    .bind(now, id, ctx.userId)
    .run();
}

export async function getSubscriptionStats(
  ctx: UserScopedDb,
  id: string
): Promise<{ unreadCount: number; latestDocumentDate: string | null }> {
  const result = await ctx.db
    .prepare(
      `SELECT
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unreadCount,
        MAX(saved_at) as latestDocumentDate
       FROM document
       WHERE source_id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
    )
    .bind(id, ctx.userId)
    .first<{ unreadCount: number; latestDocumentDate: string | null }>();
  return {
    unreadCount: result?.unreadCount ?? 0,
    latestDocumentDate: result?.latestDocumentDate ?? null,
  };
}
