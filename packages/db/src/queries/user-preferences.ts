import type { UserPreferences, UpdateUserPreferencesInput } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";

const DEFAULT_ID = "default";

export async function getUserPreferences(
  db: D1Database
): Promise<UserPreferences | null> {
  const result = await db
    .prepare("SELECT * FROM user_preferences WHERE id = ?1")
    .bind(DEFAULT_ID)
    .first<UserPreferences>();
  return result ?? null;
}

export async function upsertUserPreferences(
  db: D1Database,
  updates: UpdateUserPreferencesInput
): Promise<UserPreferences> {
  const existing = await getUserPreferences(db);
  const now = nowISO();

  if (!existing) {
    // Insert with defaults + overrides
    await db
      .prepare(
        `INSERT INTO user_preferences (id, schema_version, theme, font_family, font_size, line_height, content_width, shortcut_map_json, view_mode_prefs_json, updated_at)
         VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        DEFAULT_ID,
        updates.theme ?? "system",
        updates.font_family ?? null,
        updates.font_size ?? null,
        updates.line_height ?? null,
        updates.content_width ?? null,
        updates.shortcut_map_json ?? null,
        updates.view_mode_prefs_json ?? null,
        now
      )
      .run();
  } else {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?${paramIdx}`);
      values.push(value);
      paramIdx++;
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = ?${paramIdx}`);
    values.push(now);
    paramIdx++;

    values.push(DEFAULT_ID);

    await db
      .prepare(
        `UPDATE user_preferences SET ${fields.join(", ")} WHERE id = ?${paramIdx}`
      )
      .bind(...values)
      .run();
  }

  return (await getUserPreferences(db))!;
}
