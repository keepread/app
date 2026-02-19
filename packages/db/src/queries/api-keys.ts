import type { ApiKey } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function createApiKey(
  ctx: UserScopedDb,
  input: { key_hash: string; key_prefix: string; label: string }
): Promise<ApiKey> {
  const id = crypto.randomUUID();
  await ctx.db
    .prepare(
      "INSERT INTO api_key (id, user_id, key_hash, key_prefix, label) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(id, ctx.userId, input.key_hash, input.key_prefix, input.label)
    .run();

  const row = await ctx.db
    .prepare("SELECT * FROM api_key WHERE id = ?1")
    .bind(id)
    .first<ApiKey>();

  return row!;
}

export async function listApiKeys(ctx: UserScopedDb): Promise<ApiKey[]> {
  const result = await ctx.db
    .prepare(
      "SELECT * FROM api_key WHERE revoked_at IS NULL AND user_id = ?1 ORDER BY created_at DESC"
    )
    .bind(ctx.userId)
    .all<ApiKey>();

  return result.results;
}

export async function revokeApiKey(ctx: UserScopedDb, id: string): Promise<void> {
  await ctx.db
    .prepare(
      "UPDATE api_key SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL"
    )
    .bind(id, ctx.userId)
    .run();
}

export async function getApiKeyByHash(
  ctx: UserScopedDb,
  keyHash: string
): Promise<ApiKey | null> {
  const row = await ctx.db
    .prepare("SELECT * FROM api_key WHERE key_hash = ?1 AND user_id = ?2 AND revoked_at IS NULL")
    .bind(keyHash, ctx.userId)
    .first<ApiKey>();

  return row ?? null;
}
