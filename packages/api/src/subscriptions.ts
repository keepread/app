import type {
  SubscriptionWithStats,
  UpdateSubscriptionInput,
  CreateSubscriptionInput,
  Subscription,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  listSubscriptions,
  updateSubscription,
  softDeleteSubscription,
  createSubscription as dbCreateSubscription,
} from "@focus-reader/db";

export async function getSubscriptions(
  ctx: UserScopedDb
): Promise<SubscriptionWithStats[]> {
  return listSubscriptions(ctx);
}

export async function addSubscription(
  ctx: UserScopedDb,
  input: CreateSubscriptionInput
): Promise<Subscription> {
  return dbCreateSubscription(ctx, input);
}

export async function patchSubscription(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateSubscriptionInput
): Promise<void> {
  await updateSubscription(ctx, id, updates);
}

export async function removeSubscription(
  ctx: UserScopedDb,
  id: string,
  hard = false
): Promise<void> {
  if (hard) {
    await hardDeleteSubscription(ctx, id);
  } else {
    await softDeleteSubscription(ctx, id);
  }
}

async function hardDeleteSubscription(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  // Delete related records first (D1 doesn't enforce FK cascades)
  // Scope document deletions to user's documents
  await ctx.db.prepare("DELETE FROM document_tags WHERE document_id IN (SELECT id FROM document WHERE source_id = ?1 AND user_id = ?2)").bind(id, ctx.userId).run();
  await ctx.db.prepare("DELETE FROM document_email_meta WHERE document_id IN (SELECT id FROM document WHERE source_id = ?1 AND user_id = ?2)").bind(id, ctx.userId).run();
  await ctx.db.prepare("DELETE FROM attachment WHERE document_id IN (SELECT id FROM document WHERE source_id = ?1 AND user_id = ?2)").bind(id, ctx.userId).run();
  await ctx.db.prepare("DELETE FROM document WHERE source_id = ?1 AND user_id = ?2").bind(id, ctx.userId).run();
  await ctx.db.prepare("DELETE FROM subscription_tags WHERE subscription_id = ?1").bind(id).run();
  await ctx.db.prepare("DELETE FROM subscription WHERE id = ?1 AND user_id = ?2").bind(id, ctx.userId).run();
}
