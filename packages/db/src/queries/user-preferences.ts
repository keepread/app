import type { UserPreferences, UpdateUserPreferencesInput } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function getUserPreferences(
  ctx: UserScopedDb
): Promise<UserPreferences | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM user_preferences WHERE id = ?1")
    .bind(ctx.userId)
    .first<UserPreferences>();
  return result ?? null;
}

export async function upsertUserPreferences(
  ctx: UserScopedDb,
  updates: UpdateUserPreferencesInput
): Promise<UserPreferences> {
  const existing = await getUserPreferences(ctx);
  const now = nowISO();

  if (!existing) {
    // Insert with defaults + overrides
    await ctx.db
      .prepare(
        `INSERT INTO user_preferences (id, schema_version, theme, font_family, font_size, line_height, content_width, shortcut_map_json, view_mode_prefs_json, updated_at)
         VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        ctx.userId,
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

    values.push(ctx.userId);

    await ctx.db
      .prepare(
        `UPDATE user_preferences SET ${fields.join(", ")} WHERE id = ?${paramIdx}`
      )
      .bind(...values)
      .run();
  }

  return (await getUserPreferences(ctx))!;
}
