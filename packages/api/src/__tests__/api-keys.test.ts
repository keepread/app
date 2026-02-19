import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserScopedDb } from "@focus-reader/db";

vi.mock("@focus-reader/db", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}));

const { createApiKey: dbCreateApiKey, listApiKeys: dbListApiKeys, revokeApiKey: dbRevokeApiKey } =
  await import("@focus-reader/db");
const { generateApiKey, listApiKeys, revokeApiKey } = await import("../api-keys.js");

const mockDb = {} as D1Database;
const mockCtx = { db: mockDb, userId: "test-user-id" } as unknown as UserScopedDb;

describe("api-keys (API)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateApiKey", () => {
    it("returns a 64-char hex plaintext key and record with matching prefix", async () => {
      vi.mocked(dbCreateApiKey).mockImplementation(async (_db, input) => ({
        id: "test-id",
        user_id: "test-user-id",
        key_hash: input.key_hash,
        key_prefix: input.key_prefix,
        label: input.label,
        last_used_at: null,
        created_at: "2025-01-01T00:00:00.000Z",
        revoked_at: null,
      }));

      const result = await generateApiKey(mockCtx, "Test Label");

      // Plaintext key should be 64 hex chars (32 bytes)
      expect(result.key).toMatch(/^[0-9a-f]{64}$/);
      // Prefix should be first 8 chars
      expect(result.record.key_prefix).toBe(result.key.slice(0, 8));
      expect(result.record.label).toBe("Test Label");
    });

    it("stored hash matches SHA-256 of returned plaintext key", async () => {
      let storedHash = "";
      vi.mocked(dbCreateApiKey).mockImplementation(async (_db, input) => {
        storedHash = input.key_hash;
        return {
          id: "test-id",
          user_id: "test-user-id",
          key_hash: input.key_hash,
          key_prefix: input.key_prefix,
          label: input.label,
          last_used_at: null,
          created_at: "2025-01-01T00:00:00.000Z",
          revoked_at: null,
        };
      });

      const result = await generateApiKey(mockCtx, "Hash Test");

      // Manually hash the plaintext key and compare
      const encoder = new TextEncoder();
      const data = encoder.encode(result.key);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const expectedHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      expect(storedHash).toBe(expectedHash);
    });
  });

  describe("listApiKeys", () => {
    it("delegates to DB function", async () => {
      const mockKeys = [
        {
          id: "k1",
          user_id: "test-user-id",
          key_hash: "h1",
          key_prefix: "p1",
          label: "Key 1",
          last_used_at: null,
          created_at: "2025-01-01T00:00:00.000Z",
          revoked_at: null,
        },
      ];
      vi.mocked(dbListApiKeys).mockResolvedValue(mockKeys);

      const result = await listApiKeys(mockCtx);
      expect(result).toEqual(mockKeys);
      expect(dbListApiKeys).toHaveBeenCalledWith(mockCtx);
    });
  });

  describe("revokeApiKey", () => {
    it("delegates to DB function", async () => {
      vi.mocked(dbRevokeApiKey).mockResolvedValue(undefined);

      await revokeApiKey(mockCtx, "key-id");
      expect(dbRevokeApiKey).toHaveBeenCalledWith(mockCtx, "key-id");
    });
  });
});
