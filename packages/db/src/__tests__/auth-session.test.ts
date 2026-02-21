import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import {
  createSession,
  getSessionByTokenHash,
  deleteSessionByTokenHash,
  createVerificationToken,
  consumeVerificationToken,
  deleteExpiredSessions,
  deleteExpiredVerificationTokens,
} from "../queries/auth-session.js";
import {
  INITIAL_SCHEMA_SQL,
  FTS5_MIGRATION_SQL,
  MULTI_TENANCY_SQL,
  AUTH_HYBRID_SQL,
  FAVICON_URL_SQL,
} from "../migration-sql.js";

async function applyMigration(db: D1Database) {
  const allSql = [
    INITIAL_SCHEMA_SQL,
    FTS5_MIGRATION_SQL,
    MULTI_TENANCY_SQL,
    AUTH_HYBRID_SQL,
    FAVICON_URL_SQL,
  ].join("\n");

  const statements = allSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && s.includes(" "));

  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

describe("auth-session queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
    await env.FOCUS_DB
      .prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 0)")
      .bind("user-1", "user@example.com", "user")
      .run();
  });

  it("creates, reads, and deletes sessions by token hash", async () => {
    await createSession(env.FOCUS_DB, {
      userId: "user-1",
      tokenHash: "hash-1",
      expiresAt: "2999-01-01T00:00:00.000Z",
      ipAddress: "127.0.0.1",
      userAgent: "unit-test",
    });

    const session = await getSessionByTokenHash(env.FOCUS_DB, "hash-1");
    expect(session).not.toBeNull();
    expect(session?.user_id).toBe("user-1");

    await deleteSessionByTokenHash(env.FOCUS_DB, "hash-1");
    const deleted = await getSessionByTokenHash(env.FOCUS_DB, "hash-1");
    expect(deleted).toBeNull();
  });

  it("consumes verification tokens once", async () => {
    await createVerificationToken(env.FOCUS_DB, {
      identifier: "hashed-token-1",
      valueHash: '{"email":"user@example.com"}',
      expiresAt: "2999-01-01T00:00:00.000Z",
    });

    const first = await consumeVerificationToken(env.FOCUS_DB, "hashed-token-1");
    expect(first).toEqual({ value: '{"email":"user@example.com"}' });

    const second = await consumeVerificationToken(env.FOCUS_DB, "hashed-token-1");
    expect(second).toBeNull();
  });

  it("deletes expired sessions and used verification tokens", async () => {
    await createSession(env.FOCUS_DB, {
      userId: "user-1",
      tokenHash: "expired-hash",
      expiresAt: "2000-01-01T00:00:00.000Z",
    });

    await createVerificationToken(env.FOCUS_DB, {
      identifier: "expired-token-hash",
      valueHash: '{"email":"user@example.com"}',
      expiresAt: "2000-01-01T00:00:00.000Z",
    });

    await deleteExpiredSessions(env.FOCUS_DB);
    await deleteExpiredVerificationTokens(env.FOCUS_DB);

    expect(await getSessionByTokenHash(env.FOCUS_DB, "expired-hash")).toBeNull();
    expect(await consumeVerificationToken(env.FOCUS_DB, "expired-token-hash")).toBeNull();
  });
});
