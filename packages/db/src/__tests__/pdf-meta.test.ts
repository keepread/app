import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createDocument } from "../queries/documents.js";
import { createPdfMeta, getPdfMeta } from "../queries/pdf-meta.js";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL, MULTI_TENANCY_SQL } from "../migration-sql.js";
import { scopeDb } from "../scoped-db.js";

async function applyMigration(db: D1Database) {
  const allSql = INITIAL_SCHEMA_SQL + "\n" + FTS5_MIGRATION_SQL + "\n" + MULTI_TENANCY_SQL;
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

describe("pdf-meta queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
    await env.FOCUS_DB.prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 1)")
      .bind("test-user-id", "test@example.com", "test")
      .run();
  });

  const ctx = () => scopeDb(env.FOCUS_DB, "test-user-id");

  it("creates and retrieves pdf metadata", async () => {
    const doc = await createDocument(ctx(), {
      type: "pdf",
      title: "Test PDF",
      origin_type: "manual",
    });

    const meta = await createPdfMeta(env.FOCUS_DB, {
      document_id: doc.id,
      page_count: 42,
      file_size_bytes: 1024000,
      storage_key: `pdfs/${doc.id}/test.pdf`,
    });

    expect(meta.document_id).toBe(doc.id);
    expect(meta.page_count).toBe(42);
    expect(meta.file_size_bytes).toBe(1024000);
    expect(meta.storage_key).toBe(`pdfs/${doc.id}/test.pdf`);
  });

  it("returns null for nonexistent pdf metadata", async () => {
    const result = await getPdfMeta(env.FOCUS_DB, "nonexistent-id");
    expect(result).toBeNull();
  });

  it("retrieves pdf metadata by document id", async () => {
    const doc = await createDocument(ctx(), {
      type: "pdf",
      title: "Another PDF",
      origin_type: "manual",
    });

    await createPdfMeta(env.FOCUS_DB, {
      document_id: doc.id,
      page_count: 10,
      file_size_bytes: 500000,
      storage_key: `pdfs/${doc.id}/another.pdf`,
    });

    const fetched = await getPdfMeta(env.FOCUS_DB, doc.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.page_count).toBe(10);
    expect(fetched!.file_size_bytes).toBe(500000);
  });
});
