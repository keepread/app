import type { Denylist, CreateDenylistInput } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function isDomainDenied(
  ctx: UserScopedDb,
  domain: string
): Promise<boolean> {
  const result = await ctx.db
    .prepare("SELECT 1 FROM denylist WHERE domain = ?1 AND user_id = ?2")
    .bind(domain.toLowerCase(), ctx.userId)
    .first();
  return result !== null;
}

export async function listDenylistEntries(
  ctx: UserScopedDb
): Promise<Denylist[]> {
  const rows = await ctx.db
    .prepare("SELECT * FROM denylist WHERE user_id = ?1 ORDER BY created_at DESC")
    .bind(ctx.userId)
    .all<Denylist>();
  return rows.results;
}

export async function addDenylistEntry(
  ctx: UserScopedDb,
  input: CreateDenylistInput
): Promise<Denylist> {
  const id = crypto.randomUUID();
  const now = nowISO();
  await ctx.db
    .prepare(
      "INSERT INTO denylist (id, user_id, domain, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(id, ctx.userId, input.domain.toLowerCase(), input.reason ?? null, now)
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM denylist WHERE id = ?1")
    .bind(id)
    .first<Denylist>())!;
}

export async function removeDenylistEntry(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  await ctx.db
    .prepare("DELETE FROM denylist WHERE id = ?1 AND user_id = ?2")
    .bind(id, ctx.userId)
    .run();
}
