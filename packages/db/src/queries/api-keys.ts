import type { ApiKey } from "@focus-reader/shared";

export async function createApiKey(
  db: D1Database,
  input: { key_hash: string; key_prefix: string; label: string }
): Promise<ApiKey> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO api_key (id, key_hash, key_prefix, label) VALUES (?1, ?2, ?3, ?4)"
    )
    .bind(id, input.key_hash, input.key_prefix, input.label)
    .run();

  const row = await db
    .prepare("SELECT * FROM api_key WHERE id = ?1")
    .bind(id)
    .first<ApiKey>();

  return row!;
}

export async function listApiKeys(db: D1Database): Promise<ApiKey[]> {
  const result = await db
    .prepare(
      "SELECT * FROM api_key WHERE revoked_at IS NULL ORDER BY created_at DESC"
    )
    .all<ApiKey>();

  return result.results;
}

export async function revokeApiKey(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      "UPDATE api_key SET revoked_at = datetime('now') WHERE id = ?1 AND revoked_at IS NULL"
    )
    .bind(id)
    .run();
}

export async function getApiKeyByHash(
  db: D1Database,
  keyHash: string
): Promise<ApiKey | null> {
  const row = await db
    .prepare("SELECT * FROM api_key WHERE key_hash = ?1 AND revoked_at IS NULL")
    .bind(keyHash)
    .first<ApiKey>();

  return row ?? null;
}
