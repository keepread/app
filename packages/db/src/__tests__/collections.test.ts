import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
  deleteCollection,
  addDocumentToCollection,
  removeDocumentFromCollection,
  getCollectionDocuments,
  reorderCollectionDocuments,
  getCollectionsForDocument,
} from "../queries/collections.js";
import { createDocument } from "../queries/documents.js";
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

async function createTestDocument(ctx: ReturnType<typeof scopeDb>, title = "Test Article") {
  return createDocument(ctx, {
    type: "article",
    title,
    origin_type: "manual",
    url: `https://example.com/${crypto.randomUUID()}`,
  });
}

describe("collection queries", () => {
  let ctx: ReturnType<typeof scopeDb>;

  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
    await env.FOCUS_DB.prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 1)")
      .bind("test-user-id", "test@example.com", "test")
      .run();
    ctx = scopeDb(env.FOCUS_DB, "test-user-id");
  });

  describe("createCollection + getCollection", () => {
    it("creates and retrieves a collection", async () => {
      const collection = await createCollection(ctx, {
        name: "Reading List",
        description: "My favorite articles",
      });

      expect(collection.id).toBeDefined();
      expect(collection.name).toBe("Reading List");
      expect(collection.description).toBe("My favorite articles");
      expect(collection.created_at).toBeDefined();

      const fetched = await getCollection(ctx, collection.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe("Reading List");
    });

    it("creates with custom id", async () => {
      const customId = crypto.randomUUID();
      const collection = await createCollection(ctx, {
        id: customId,
        name: "Custom",
      });
      expect(collection.id).toBe(customId);
    });
  });

  describe("listCollections", () => {
    it("returns collections with document counts", async () => {
      const c1 = await createCollection(ctx, { name: "A Collection" });
      await createCollection(ctx, { name: "B Collection" });
      const doc = await createTestDocument(ctx);
      await addDocumentToCollection(ctx, c1.id, doc.id);

      const list = await listCollections(ctx);
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe("A Collection");
      expect(list[0].documentCount).toBe(1);
      expect(list[1].name).toBe("B Collection");
      expect(list[1].documentCount).toBe(0);
    });
  });

  describe("updateCollection", () => {
    it("updates name and description", async () => {
      const collection = await createCollection(ctx, { name: "Old" });
      await updateCollection(ctx, collection.id, {
        name: "New",
        description: "Updated",
      });

      const fetched = await getCollection(ctx, collection.id);
      expect(fetched!.name).toBe("New");
      expect(fetched!.description).toBe("Updated");
    });
  });

  describe("deleteCollection", () => {
    it("deletes collection and its document links", async () => {
      const collection = await createCollection(ctx, { name: "Delete Me" });
      const doc = await createTestDocument(ctx);
      await addDocumentToCollection(ctx, collection.id, doc.id);

      await deleteCollection(ctx, collection.id);

      expect(await getCollection(ctx, collection.id)).toBeNull();
      const linkCount = await env.FOCUS_DB
        .prepare("SELECT COUNT(*) as count FROM collection_documents WHERE collection_id = ?1")
        .bind(collection.id)
        .first<{ count: number }>();
      expect(linkCount!.count).toBe(0);
    });
  });

  describe("addDocumentToCollection + removeDocumentFromCollection", () => {
    it("adds and removes documents", async () => {
      const collection = await createCollection(ctx, { name: "Test" });
      const doc1 = await createTestDocument(ctx, "Doc 1");
      const doc2 = await createTestDocument(ctx, "Doc 2");

      await addDocumentToCollection(ctx, collection.id, doc1.id);
      await addDocumentToCollection(ctx, collection.id, doc2.id);

      let docs = await getCollectionDocuments(ctx, collection.id);
      expect(docs).toHaveLength(2);

      await removeDocumentFromCollection(ctx, collection.id, doc1.id);
      docs = await getCollectionDocuments(ctx, collection.id);
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("Doc 2");
    });

    it("auto-assigns sort_order", async () => {
      const collection = await createCollection(ctx, { name: "Sorted" });
      const doc1 = await createTestDocument(ctx, "First");
      const doc2 = await createTestDocument(ctx, "Second");

      await addDocumentToCollection(ctx, collection.id, doc1.id);
      await addDocumentToCollection(ctx, collection.id, doc2.id);

      const docs = await getCollectionDocuments(ctx, collection.id);
      expect(docs[0].sort_order).toBe(0);
      expect(docs[1].sort_order).toBe(1);
    });

    it("is idempotent (INSERT OR IGNORE)", async () => {
      const collection = await createCollection(ctx, { name: "Test" });
      const doc = await createTestDocument(ctx);

      await addDocumentToCollection(ctx, collection.id, doc.id);
      await addDocumentToCollection(ctx, collection.id, doc.id);

      const docs = await getCollectionDocuments(ctx, collection.id);
      expect(docs).toHaveLength(1);
    });
  });

  describe("reorderCollectionDocuments", () => {
    it("batch-updates sort_order", async () => {
      const collection = await createCollection(ctx, { name: "Reorder" });
      const doc1 = await createTestDocument(ctx, "A");
      const doc2 = await createTestDocument(ctx, "B");
      const doc3 = await createTestDocument(ctx, "C");

      await addDocumentToCollection(ctx, collection.id, doc1.id);
      await addDocumentToCollection(ctx, collection.id, doc2.id);
      await addDocumentToCollection(ctx, collection.id, doc3.id);

      // Reverse order
      await reorderCollectionDocuments(ctx, collection.id, [
        doc3.id,
        doc2.id,
        doc1.id,
      ]);

      const docs = await getCollectionDocuments(ctx, collection.id);
      expect(docs[0].title).toBe("C");
      expect(docs[1].title).toBe("B");
      expect(docs[2].title).toBe("A");
    });
  });

  describe("getCollectionsForDocument", () => {
    it("returns collections containing a document", async () => {
      const c1 = await createCollection(ctx, { name: "List 1" });
      const c2 = await createCollection(ctx, { name: "List 2" });
      await createCollection(ctx, { name: "List 3" });
      const doc = await createTestDocument(ctx);

      await addDocumentToCollection(ctx, c1.id, doc.id);
      await addDocumentToCollection(ctx, c2.id, doc.id);

      const collections = await getCollectionsForDocument(ctx, doc.id);
      expect(collections).toHaveLength(2);
    });
  });
});
