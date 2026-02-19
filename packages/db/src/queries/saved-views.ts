import type {
  SavedView,
  CreateSavedViewInput,
  UpdateSavedViewInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createSavedView(
  ctx: UserScopedDb,
  input: CreateSavedViewInput
): Promise<SavedView> {
  const id = crypto.randomUUID();
  const now = nowISO();

  await ctx.db
    .prepare(
      `INSERT INTO saved_view (
        id, user_id, name, query_ast_json, sort_json, is_system, pinned_order,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`
    )
    .bind(
      id,
      ctx.userId,
      input.name,
      input.query_ast_json,
      input.sort_json ?? null,
      input.is_system ?? 0,
      input.pinned_order ?? null,
      now
    )
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM saved_view WHERE id = ?1")
    .bind(id)
    .first<SavedView>())!;
}

export async function listSavedViews(
  ctx: UserScopedDb
): Promise<SavedView[]> {
  const result = await ctx.db
    .prepare(
      "SELECT * FROM saved_view WHERE deleted_at IS NULL AND user_id = ?1 ORDER BY pinned_order ASC NULLS LAST, created_at ASC"
    )
    .bind(ctx.userId)
    .all<SavedView>();
  return result.results;
}

export async function getSavedView(
  ctx: UserScopedDb,
  id: string
): Promise<SavedView | null> {
  const result = await ctx.db
    .prepare("SELECT * FROM saved_view WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL")
    .bind(id, ctx.userId)
    .first<SavedView>();
  return result ?? null;
}

export async function updateSavedView(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateSavedViewInput
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = ?${paramIndex}`);
  values.push(nowISO());
  paramIndex++;

  values.push(id, ctx.userId);

  await ctx.db
    .prepare(
      `UPDATE saved_view SET ${fields.join(", ")} WHERE id = ?${paramIndex} AND user_id = ?${paramIndex + 1}`
    )
    .bind(...values)
    .run();
}

export async function deleteSavedView(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  const now = nowISO();
  await ctx.db
    .prepare("UPDATE saved_view SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3")
    .bind(now, id, ctx.userId)
    .run();
}
