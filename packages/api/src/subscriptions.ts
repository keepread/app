import type {
  SubscriptionWithStats,
  UpdateSubscriptionInput,
} from "@focus-reader/shared";
import {
  listSubscriptions,
  updateSubscription,
  softDeleteSubscription,
} from "@focus-reader/db";

export async function getSubscriptions(
  db: D1Database
): Promise<SubscriptionWithStats[]> {
  return listSubscriptions(db);
}

export async function patchSubscription(
  db: D1Database,
  id: string,
  updates: UpdateSubscriptionInput
): Promise<void> {
  await updateSubscription(db, id, updates);
}

export async function removeSubscription(
  db: D1Database,
  id: string
): Promise<void> {
  await softDeleteSubscription(db, id);
}
