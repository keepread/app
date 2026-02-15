import type { UserPreferences, UpdateUserPreferencesInput } from "@focus-reader/shared";
import {
  getUserPreferences,
  upsertUserPreferences,
} from "@focus-reader/db";

export async function getPreferences(
  db: D1Database
): Promise<UserPreferences> {
  const prefs = await getUserPreferences(db);
  if (prefs) return prefs;
  // Return defaults if no preferences exist yet
  return upsertUserPreferences(db, {});
}

export async function updatePreferences(
  db: D1Database,
  updates: UpdateUserPreferencesInput
): Promise<UserPreferences> {
  return upsertUserPreferences(db, updates);
}
