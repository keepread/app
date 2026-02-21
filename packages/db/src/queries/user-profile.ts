import type { User } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function getCurrentUser(
  ctx: UserScopedDb
): Promise<User | null> {
  const row = await ctx.db
    .prepare("SELECT * FROM user WHERE id = ?1")
    .bind(ctx.userId)
    .first<User>();
  return row ?? null;
}

export async function getUserBySlugForOtherUser(
  ctx: UserScopedDb,
  slug: string
): Promise<User | null> {
  const row = await ctx.db
    .prepare("SELECT * FROM user WHERE slug = ?1 AND id != ?2")
    .bind(slug, ctx.userId)
    .first<User>();
  return row ?? null;
}

export async function updateCurrentUserSlugAndOnboarding(
  ctx: UserScopedDb,
  slug: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare(
      `UPDATE user
       SET slug = ?1,
           onboarding_completed_at = COALESCE(onboarding_completed_at, ?2),
           updated_at = ?2
       WHERE id = ?3`
    )
    .bind(slug, now, ctx.userId)
    .run();
}
