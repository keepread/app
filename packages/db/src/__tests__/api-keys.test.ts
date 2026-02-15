import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getApiKeyByHash,
} from "../queries/api-keys.js";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL } from "../migration-sql.js";

async function applyMigration(db: D1Database) {
  const allSql = INITIAL_SCHEMA_SQL + "\n" + FTS5_MIGRATION_SQL;
  const statements = allSql
    .split(";")
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !s.startsWith("--") &&
        !s.match(/^--/) &&
        s.includes(" ")
    );

  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

describe("api-key queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
  });

  describe("createApiKey", () => {
    it("creates a key and returns record with correct fields", async () => {
      const record = await createApiKey(env.FOCUS_DB, {
        key_hash: "abc123hash",
        key_prefix: "abc12345",
        label: "Test Key",
      });

      expect(record.id).toBeDefined();
      expect(record.key_hash).toBe("abc123hash");
      expect(record.key_prefix).toBe("abc12345");
      expect(record.label).toBe("Test Key");
      expect(record.created_at).toBeDefined();
      expect(record.revoked_at).toBeNull();
      expect(record.last_used_at).toBeNull();
    });
  });

  describe("listApiKeys", () => {
    it("lists only non-revoked keys ordered by created_at DESC", async () => {
      const key1 = await createApiKey(env.FOCUS_DB, {
        key_hash: "hash1",
        key_prefix: "prefix01",
        label: "Key 1",
      });
      const key2 = await createApiKey(env.FOCUS_DB, {
        key_hash: "hash2",
        key_prefix: "prefix02",
        label: "Key 2",
      });
      const key3 = await createApiKey(env.FOCUS_DB, {
        key_hash: "hash3",
        key_prefix: "prefix03",
        label: "Key 3",
      });

      // Revoke key2
      await revokeApiKey(env.FOCUS_DB, key2.id);

      const keys = await listApiKeys(env.FOCUS_DB);
      expect(keys).toHaveLength(2);
      // Most recent first
      expect(keys[0].id).toBe(key3.id);
      expect(keys[1].id).toBe(key1.id);
    });
  });

  describe("revokeApiKey", () => {
    it("revoked key no longer appears in listApiKeys", async () => {
      const key = await createApiKey(env.FOCUS_DB, {
        key_hash: "hashToRevoke",
        key_prefix: "revoke01",
        label: "Will Revoke",
      });

      let keys = await listApiKeys(env.FOCUS_DB);
      expect(keys).toHaveLength(1);

      await revokeApiKey(env.FOCUS_DB, key.id);

      keys = await listApiKeys(env.FOCUS_DB);
      expect(keys).toHaveLength(0);
    });
  });

  describe("getApiKeyByHash", () => {
    it("finds key by hash", async () => {
      const created = await createApiKey(env.FOCUS_DB, {
        key_hash: "findableHash",
        key_prefix: "find0001",
        label: "Findable",
      });

      const found = await getApiKeyByHash(env.FOCUS_DB, "findableHash");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.label).toBe("Findable");
    });

    it("returns null for revoked key", async () => {
      const created = await createApiKey(env.FOCUS_DB, {
        key_hash: "revokedHash",
        key_prefix: "revoked1",
        label: "Revoked",
      });

      await revokeApiKey(env.FOCUS_DB, created.id);

      const found = await getApiKeyByHash(env.FOCUS_DB, "revokedHash");
      expect(found).toBeNull();
    });

    it("returns null for non-existent hash", async () => {
      const found = await getApiKeyByHash(env.FOCUS_DB, "nonexistent");
      expect(found).toBeNull();
    });
  });
});
