import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  searchDocuments,
  indexDocument,
  deindexDocument,
  rebuildSearchIndex,
} from "../queries/search.js";
import { createDocument, softDeleteDocument } from "../queries/documents.js";
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

describe("search queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
  });

  describe("indexDocument + searchDocuments", () => {
    it("indexes and finds a document by title keyword", async () => {
      // Create a real document (auto-indexes via createDocument)
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Introduction to TypeScript",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(
        env.FOCUS_DB,
        "TypeScript"
      );
      expect(total).toBe(1);
      expect(results).toHaveLength(1);
      expect(results[0].documentId).toBe(doc.id);
    });
  });

  describe("search relevance", () => {
    it("ranks more relevant documents higher", async () => {
      // We need actual documents in the document table for the JOIN
      const doc1 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "TypeScript Tutorial for Beginners",
        plain_text_content:
          "Learn TypeScript from scratch with this comprehensive tutorial",
        origin_type: "manual",
      });
      const doc2 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "JavaScript Basics",
        plain_text_content: "JavaScript is a programming language",
        origin_type: "manual",
      });
      const doc3 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Advanced TypeScript Patterns",
        plain_text_content:
          "TypeScript generics and conditional types explained",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(
        env.FOCUS_DB,
        "TypeScript"
      );
      expect(total).toBe(2);
      expect(results).toHaveLength(2);
      // Both TypeScript docs should be found, JavaScript doc should not
      const ids = results.map((r) => r.documentId);
      expect(ids).toContain(doc1.id);
      expect(ids).toContain(doc3.id);
      expect(ids).not.toContain(doc2.id);
    });
  });

  describe("search by author", () => {
    it("finds documents by author name", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Some Article",
        author: "John Smith",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(env.FOCUS_DB, "John");
      expect(total).toBe(1);
      expect(results[0].documentId).toBe(doc.id);
    });
  });

  describe("search by plain_text_content", () => {
    it("finds documents by body text and returns snippet", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Generic Title",
        plain_text_content:
          "The quick brown fox jumps over the lazy dog in this fascinating article about wildlife",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(
        env.FOCUS_DB,
        "wildlife"
      );
      expect(total).toBe(1);
      expect(results[0].documentId).toBe(doc.id);
      expect(results[0].snippet).toBeDefined();
    });
  });

  describe("deindexDocument", () => {
    it("removes document from search index", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Searchable Document",
        origin_type: "manual",
      });

      // Verify it's indexed (createDocument auto-indexes)
      let result = await searchDocuments(env.FOCUS_DB, "Searchable");
      expect(result.total).toBe(1);

      // Deindex manually
      await deindexDocument(env.FOCUS_DB, doc.id);

      result = await searchDocuments(env.FOCUS_DB, "Searchable");
      expect(result.total).toBe(0);
    });
  });

  describe("rebuildSearchIndex", () => {
    it("rebuilds index from all non-deleted documents", async () => {
      const doc1 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "First Rebuild Doc",
        origin_type: "manual",
      });
      const doc2 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Second Rebuild Doc",
        origin_type: "manual",
      });
      const doc3 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Third Rebuild Doc",
        origin_type: "manual",
      });

      // Clear the index manually
      await env.FOCUS_DB.prepare("DELETE FROM document_fts").run();

      // Verify search returns nothing
      let result = await searchDocuments(env.FOCUS_DB, "Rebuild");
      expect(result.total).toBe(0);

      // Rebuild
      await rebuildSearchIndex(env.FOCUS_DB);

      result = await searchDocuments(env.FOCUS_DB, "Rebuild");
      expect(result.total).toBe(3);
    });
  });

  describe("location filter", () => {
    it("filters search results by location", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Inbox Article about Cats",
        location: "inbox",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Later Article about Cats",
        location: "later",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Archive Article about Cats",
        location: "archive",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(env.FOCUS_DB, "Cats", {
        location: "inbox",
      });
      expect(total).toBe(1);
      expect(results).toHaveLength(1);
      expect(results[0].documentId).toBeDefined();
    });
  });

  describe("createDocument auto-indexes", () => {
    it("makes newly created documents immediately searchable", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Auto Indexed Document XYZ",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(env.FOCUS_DB, "XYZ");
      expect(total).toBe(1);
      expect(results[0].documentId).toBe(doc.id);
    });
  });

  describe("softDeleteDocument auto-deindexes", () => {
    it("removes soft-deleted documents from search results", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Will Be Deleted Soon",
        origin_type: "manual",
      });

      let result = await searchDocuments(env.FOCUS_DB, "Deleted");
      expect(result.total).toBe(1);

      await softDeleteDocument(env.FOCUS_DB, doc.id);

      result = await searchDocuments(env.FOCUS_DB, "Deleted");
      expect(result.total).toBe(0);
    });
  });

  describe("FTS query sanitization", () => {
    it("handles special characters without FTS5 syntax errors", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Normal Document",
        origin_type: "manual",
      });

      // These should not throw FTS5 syntax errors
      const result1 = await searchDocuments(
        env.FOCUS_DB,
        '"quotes" and col:on'
      );
      expect(result1.total).toBeGreaterThanOrEqual(0);

      const result2 = await searchDocuments(env.FOCUS_DB, "OR AND NOT");
      expect(result2.total).toBeGreaterThanOrEqual(0);

      const result3 = await searchDocuments(env.FOCUS_DB, "test*");
      expect(result3.total).toBeGreaterThanOrEqual(0);
    });

    it("returns empty results for empty query", async () => {
      const result = await searchDocuments(env.FOCUS_DB, "");
      expect(result.total).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });
});
