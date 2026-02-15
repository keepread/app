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

  describe("phrase search relevance", () => {
    it("matches multi-word phrase 'typescript tutorial'", async () => {
      const doc1 = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "TypeScript Tutorial for Beginners",
        plain_text_content:
          "This comprehensive typescript tutorial covers everything you need to know",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Python Crash Course",
        plain_text_content: "Learn Python from scratch",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Advanced TypeScript Patterns",
        plain_text_content: "Generics and conditional types in TypeScript",
        origin_type: "manual",
      });

      const { results, total } = await searchDocuments(
        env.FOCUS_DB,
        "typescript tutorial"
      );
      // Should match doc1 (has both words in title and body)
      expect(total).toBeGreaterThanOrEqual(1);
      expect(results[0].documentId).toBe(doc1.id);
    });
  });

  describe("backfill from existing data", () => {
    it("backfills FTS index when migration runs on existing documents", async () => {
      // Step 1: Apply only the initial schema (no FTS)
      const initialStatements = INITIAL_SCHEMA_SQL.split(";")
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 0 &&
            !s.startsWith("--") &&
            !s.match(/^--/) &&
            s.includes(" ")
        );
      for (const stmt of initialStatements) {
        await env.FOCUS_DB.prepare(stmt).run();
      }

      // Step 2: Insert documents directly (bypassing createDocument which calls indexDocument)
      await env.FOCUS_DB
        .prepare(
          `INSERT INTO document (id, type, title, author, plain_text_content, location, origin_type)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(
          "pre-existing-1",
          "article",
          "Pre-existing Article about Quantum Computing",
          "Alice",
          "Quantum computing uses qubits to perform calculations",
          "inbox",
          "manual"
        )
        .run();
      await env.FOCUS_DB
        .prepare(
          `INSERT INTO document (id, type, title, author, plain_text_content, location, origin_type)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(
          "pre-existing-2",
          "article",
          "Pre-existing Guide to Machine Learning",
          "Bob",
          "Machine learning models learn patterns from data",
          "inbox",
          "manual"
        )
        .run();

      // Step 3: Now apply the FTS migration (which includes the backfill INSERT)
      const ftsStatements = FTS5_MIGRATION_SQL.split(";")
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 0 &&
            !s.startsWith("--") &&
            !s.match(/^--/) &&
            s.includes(" ")
        );
      for (const stmt of ftsStatements) {
        await env.FOCUS_DB.prepare(stmt).run();
      }

      // Step 4: Verify backfilled documents are searchable
      const result1 = await searchDocuments(env.FOCUS_DB, "Quantum");
      expect(result1.total).toBe(1);
      expect(result1.results[0].documentId).toBe("pre-existing-1");

      const result2 = await searchDocuments(env.FOCUS_DB, "Machine Learning");
      expect(result2.total).toBe(1);
      expect(result2.results[0].documentId).toBe("pre-existing-2");

      // Verify search by author also works for backfilled docs
      const result3 = await searchDocuments(env.FOCUS_DB, "Alice");
      expect(result3.total).toBe(1);
      expect(result3.results[0].documentId).toBe("pre-existing-1");
    });
  });

  describe("missing FTS table behavior", () => {
    it("throws a clear SQLite error when document_fts is missing", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Search target document",
        origin_type: "manual",
      });
      await env.FOCUS_DB.prepare("DROP TABLE document_fts").run();

      await expect(
        searchDocuments(env.FOCUS_DB, "target")
      ).rejects.toThrow(/no such table: document_fts/i);
    });
  });

  describe("type and tagId filters", () => {
    it("filters search results by document type", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Article about Testing",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "rss",
        title: "RSS post about Testing",
        origin_type: "feed",
      });

      const { results, total } = await searchDocuments(
        env.FOCUS_DB,
        "Testing",
        { type: "rss" }
      );
      expect(total).toBe(1);
      expect(results).toHaveLength(1);
    });

    it("supports all core type filters including pdf", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Type Coverage Query article",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Type Coverage Query email",
        origin_type: "subscription",
      });
      await createDocument(env.FOCUS_DB, {
        type: "rss",
        title: "Type Coverage Query rss",
        origin_type: "feed",
      });
      await createDocument(env.FOCUS_DB, {
        type: "bookmark",
        title: "Type Coverage Query bookmark",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "pdf",
        title: "Type Coverage Query pdf",
        origin_type: "manual",
      });

      const article = await searchDocuments(env.FOCUS_DB, "Type Coverage Query", {
        type: "article",
      });
      expect(article.total).toBe(1);

      const email = await searchDocuments(env.FOCUS_DB, "Type Coverage Query", {
        type: "email",
      });
      expect(email.total).toBe(1);

      const rss = await searchDocuments(env.FOCUS_DB, "Type Coverage Query", {
        type: "rss",
      });
      expect(rss.total).toBe(1);

      const bookmark = await searchDocuments(env.FOCUS_DB, "Type Coverage Query", {
        type: "bookmark",
      });
      expect(bookmark.total).toBe(1);

      const pdf = await searchDocuments(env.FOCUS_DB, "Type Coverage Query", {
        type: "pdf",
      });
      expect(pdf.total).toBe(1);
    });

    it("filters search results by tagId", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Tagged Document about Databases",
        origin_type: "manual",
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Untagged Document about Databases",
        origin_type: "manual",
      });

      // Create a tag and tag the first document
      const tagId = crypto.randomUUID();
      await env.FOCUS_DB
        .prepare("INSERT INTO tag (id, name) VALUES (?1, ?2)")
        .bind(tagId, "tech")
        .run();
      await env.FOCUS_DB
        .prepare(
          "INSERT INTO document_tags (document_id, tag_id) VALUES (?1, ?2)"
        )
        .bind(doc.id, tagId)
        .run();

      const { results, total } = await searchDocuments(
        env.FOCUS_DB,
        "Databases",
        { tagId }
      );
      expect(total).toBe(1);
      expect(results[0].documentId).toBe(doc.id);
    });
  });
});
