import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  getUserPreferences,
  upsertUserPreferences,
} from "../queries/user-preferences.js";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL, INDEXES_MIGRATION_SQL, MULTI_TENANCY_SQL } from "../migration-sql.js";
import { scopeDb } from "../scoped-db.js";

async function applyMigration(db: D1Database) {
  const allSql = INITIAL_SCHEMA_SQL + "\n" + FTS5_MIGRATION_SQL + "\n" + INDEXES_MIGRATION_SQL + "\n" + MULTI_TENANCY_SQL;
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

describe("user preferences queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
    await env.FOCUS_DB.prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 1)")
      .bind("test-user-id", "test@example.com", "test")
      .run();
  });

  const ctx = () => scopeDb(env.FOCUS_DB, "test-user-id");

  describe("getUserPreferences", () => {
    it("returns null when no preferences exist", async () => {
      const prefs = await getUserPreferences(ctx());
      expect(prefs).toBeNull();
    });
  });

  describe("upsertUserPreferences", () => {
    it("creates default preferences on first call", async () => {
      const prefs = await upsertUserPreferences(ctx(), {});
      expect(prefs).not.toBeNull();
      expect(prefs.id).toBe("test-user-id");
      expect(prefs.theme).toBe("system");
      expect(prefs.font_family).toBeNull();
      expect(prefs.font_size).toBeNull();
    });

    it("creates preferences with specified values", async () => {
      const prefs = await upsertUserPreferences(ctx(), {
        font_family: "serif",
        font_size: 20,
        line_height: 1.8,
        content_width: 720,
      });
      expect(prefs.font_family).toBe("serif");
      expect(prefs.font_size).toBe(20);
      expect(prefs.line_height).toBe(1.8);
      expect(prefs.content_width).toBe(720);
    });

    it("updates existing preferences", async () => {
      await upsertUserPreferences(ctx(), { font_size: 16 });
      const updated = await upsertUserPreferences(ctx(), {
        font_size: 22,
        font_family: "mono",
      });
      expect(updated.font_size).toBe(22);
      expect(updated.font_family).toBe("mono");
    });

    it("preserves unmodified fields on update", async () => {
      await upsertUserPreferences(ctx(), {
        font_family: "serif",
        font_size: 20,
      });
      const updated = await upsertUserPreferences(ctx(), {
        font_size: 18,
      });
      expect(updated.font_family).toBe("serif");
      expect(updated.font_size).toBe(18);
    });

    it("handles empty updates gracefully", async () => {
      const created = await upsertUserPreferences(ctx(), {
        font_size: 16,
      });
      const same = await upsertUserPreferences(ctx(), {});
      expect(same.font_size).toBe(created.font_size);
    });
  });
});
