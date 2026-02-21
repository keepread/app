import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  createSavedView,
  listSavedViews,
  getSavedView,
  updateSavedView,
  deleteSavedView,
} from "../queries/saved-views.js";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL, MULTI_TENANCY_SQL, AUTH_HYBRID_SQL, FAVICON_URL_SQL } from "../migration-sql.js";
import { scopeDb } from "../scoped-db.js";

async function applyMigration(db: D1Database) {
  const allSql = INITIAL_SCHEMA_SQL + "\n" + FTS5_MIGRATION_SQL + "\n" + MULTI_TENANCY_SQL + "\n" + AUTH_HYBRID_SQL + "\n" + FAVICON_URL_SQL;
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

describe("saved-views queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
    await env.FOCUS_DB.prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 1)")
      .bind("test-user-id", "test@example.com", "test")
      .run();
  });

  const ctx = () => scopeDb(env.FOCUS_DB, "test-user-id");

  it("creates and retrieves a saved view", async () => {
    const view = await createSavedView(ctx(), {
      name: "Newsletters",
      query_ast_json:
        '{"filters":[{"field":"type","operator":"eq","value":"email"}],"combinator":"and"}',
      is_system: 1,
      pinned_order: 1,
    });

    expect(view.id).toBeDefined();
    expect(view.name).toBe("Newsletters");
    expect(view.is_system).toBe(1);
    expect(view.pinned_order).toBe(1);

    const fetched = await getSavedView(ctx(), view.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Newsletters");
  });

  it("lists all non-deleted saved views", async () => {
    await createSavedView(ctx(), {
      name: "View 1",
      query_ast_json: '{"filters":[],"combinator":"and"}',
      pinned_order: 2,
    });
    await createSavedView(ctx(), {
      name: "View 2",
      query_ast_json: '{"filters":[],"combinator":"and"}',
      pinned_order: 1,
    });

    const views = await listSavedViews(ctx());
    expect(views).toHaveLength(2);
    // Should be ordered by pinned_order ASC
    expect(views[0].name).toBe("View 2");
    expect(views[1].name).toBe("View 1");
  });

  it("updates a saved view", async () => {
    const view = await createSavedView(ctx(), {
      name: "Original",
      query_ast_json: '{"filters":[],"combinator":"and"}',
    });

    await updateSavedView(ctx(), view.id, { name: "Renamed" });

    const fetched = await getSavedView(ctx(), view.id);
    expect(fetched!.name).toBe("Renamed");
  });

  it("soft deletes a saved view", async () => {
    const view = await createSavedView(ctx(), {
      name: "To Delete",
      query_ast_json: '{"filters":[],"combinator":"and"}',
    });

    await deleteSavedView(ctx(), view.id);

    const fetched = await getSavedView(ctx(), view.id);
    expect(fetched).toBeNull();

    const all = await listSavedViews(ctx());
    expect(all).toHaveLength(0);
  });

  it("returns null for nonexistent view", async () => {
    const fetched = await getSavedView(ctx(), "nonexistent");
    expect(fetched).toBeNull();
  });
});
