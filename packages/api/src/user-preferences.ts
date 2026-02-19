import type { UserPreferences, UpdateUserPreferencesInput } from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  getUserPreferences,
  upsertUserPreferences,
} from "@focus-reader/db";

export async function getPreferences(
  ctx: UserScopedDb
): Promise<UserPreferences> {
  const prefs = await getUserPreferences(ctx);
  if (prefs) return prefs;
  // Return defaults if no preferences exist yet
  return upsertUserPreferences(ctx, {});
}

export async function updatePreferences(
  ctx: UserScopedDb,
  updates: UpdateUserPreferencesInput
): Promise<UserPreferences> {
  return upsertUserPreferences(ctx, updates);
}
