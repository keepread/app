import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  createDocument,
  getDocument,
  getDocumentByUrl,
  softDeleteDocument,
  updateDocument,
} from "../queries/documents.js";
import {
  createEmailMeta,
  getEmailMetaByMessageId,
  getEmailMetaByFingerprint,
  incrementDeliveryAttempts,
} from "../queries/email-meta.js";
import {
  createSubscription,
  getSubscriptionByEmail,
} from "../queries/subscriptions.js";
import {
  createTag,
  getTagsForSubscription,
  addTagToDocument,
} from "../queries/tags.js";
import { logIngestionEvent } from "../queries/ingestion-log.js";
import { isDomainDenied } from "../queries/denylist.js";
import { createAttachment } from "../queries/attachments.js";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL } from "../migration-sql.js";

async function applyMigration(db: D1Database) {
  // Split SQL into individual statements and execute via prepare().run()
  // db.exec() has a workerd bug with response metadata, so we avoid it.
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

describe("db queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
  });

  describe("documents", () => {
    it("creates and retrieves a document", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Test Newsletter",
        origin_type: "subscription",
        html_content: "<p>Hello world</p>",
        word_count: 2,
        reading_time_minutes: 1,
      });

      expect(doc.id).toBeDefined();
      expect(doc.type).toBe("email");
      expect(doc.title).toBe("Test Newsletter");
      expect(doc.location).toBe("inbox");
      expect(doc.is_read).toBe(0);
      expect(doc.origin_type).toBe("subscription");

      const fetched = await getDocument(env.FOCUS_DB, doc.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe("Test Newsletter");
    });

    it("creates document with pre-generated id", async () => {
      const customId = crypto.randomUUID();
      const doc = await createDocument(env.FOCUS_DB, {
        id: customId,
        type: "email",
        title: "Pre-ID Doc",
        origin_type: "subscription",
      });
      expect(doc.id).toBe(customId);
    });

    it("gets document by URL", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Article",
        url: "https://example.com/post",
        origin_type: "manual",
      });

      const found = await getDocumentByUrl(
        env.FOCUS_DB,
        "https://example.com/post"
      );
      expect(found).not.toBeNull();
      expect(found!.title).toBe("Article");
    });

    it("getDocumentByUrl excludes soft-deleted documents", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Deletable",
        url: "https://example.com/deletable",
        origin_type: "manual",
      });

      await softDeleteDocument(env.FOCUS_DB, doc.id);

      const found = await getDocumentByUrl(
        env.FOCUS_DB,
        "https://example.com/deletable"
      );
      expect(found).toBeNull();
    });

    it("updates document fields", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Test",
        origin_type: "subscription",
      });

      await updateDocument(env.FOCUS_DB, doc.id, {
        is_read: 1,
        location: "archive",
      });

      const updated = await getDocument(env.FOCUS_DB, doc.id);
      expect(updated!.is_read).toBe(1);
      expect(updated!.location).toBe("archive");
    });
  });

  describe("email meta", () => {
    it("creates email meta with message_id dedup", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Newsletter",
        origin_type: "subscription",
      });

      const meta = await createEmailMeta(env.FOCUS_DB, {
        document_id: doc.id,
        message_id: "abc123@example.com",
        from_address: "sender@newsletter.com",
        from_name: "Sender",
      });

      expect(meta.message_id).toBe("abc123@example.com");
      expect(meta.delivery_attempts).toBe(1);

      const found = await getEmailMetaByMessageId(
        env.FOCUS_DB,
        "abc123@example.com"
      );
      expect(found).not.toBeNull();
      expect(found!.document_id).toBe(doc.id);
    });

    it("looks up by fingerprint", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Newsletter",
        origin_type: "subscription",
      });

      await createEmailMeta(env.FOCUS_DB, {
        document_id: doc.id,
        fingerprint: "sha256-abc123",
        from_address: "sender@newsletter.com",
      });

      const found = await getEmailMetaByFingerprint(
        env.FOCUS_DB,
        "sha256-abc123"
      );
      expect(found).not.toBeNull();
      expect(found!.document_id).toBe(doc.id);
    });

    it("increments delivery attempts", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Newsletter",
        origin_type: "subscription",
      });

      await createEmailMeta(env.FOCUS_DB, {
        document_id: doc.id,
        from_address: "sender@newsletter.com",
      });

      await incrementDeliveryAttempts(env.FOCUS_DB, doc.id);

      const row = await env.FOCUS_DB.prepare(
        "SELECT delivery_attempts FROM document_email_meta WHERE document_id = ?1"
      )
        .bind(doc.id)
        .first<{ delivery_attempts: number }>();
      expect(row!.delivery_attempts).toBe(2);
    });
  });

  describe("subscriptions", () => {
    it("creates and finds subscription by email", async () => {
      const sub = await createSubscription(env.FOCUS_DB, {
        pseudo_email: "morning-brew@read.example.com",
        display_name: "Morning Brew",
        sender_address: "newsletter@morningbrew.com",
      });

      expect(sub.pseudo_email).toBe("morning-brew@read.example.com");
      expect(sub.is_active).toBe(1);

      const found = await getSubscriptionByEmail(
        env.FOCUS_DB,
        "morning-brew@read.example.com"
      );
      expect(found).not.toBeNull();
      expect(found!.display_name).toBe("Morning Brew");
    });

    it("returns null for unknown email", async () => {
      const found = await getSubscriptionByEmail(
        env.FOCUS_DB,
        "unknown@read.example.com"
      );
      expect(found).toBeNull();
    });
  });

  describe("tags", () => {
    it("creates a tag", async () => {
      const tag = await createTag(env.FOCUS_DB, {
        name: "tech",
        color: "#0000FF",
      });
      expect(tag.name).toBe("tech");
      expect(tag.color).toBe("#0000FF");
    });

    it("gets tags for subscription", async () => {
      const sub = await createSubscription(env.FOCUS_DB, {
        pseudo_email: "test@read.example.com",
        display_name: "Test",
      });

      const tag1 = await createTag(env.FOCUS_DB, { name: "tech" });
      const tag2 = await createTag(env.FOCUS_DB, { name: "ai" });

      await env.FOCUS_DB.prepare(
        "INSERT INTO subscription_tags (subscription_id, tag_id) VALUES (?1, ?2)"
      )
        .bind(sub.id, tag1.id)
        .run();
      await env.FOCUS_DB.prepare(
        "INSERT INTO subscription_tags (subscription_id, tag_id) VALUES (?1, ?2)"
      )
        .bind(sub.id, tag2.id)
        .run();

      const tags = await getTagsForSubscription(env.FOCUS_DB, sub.id);
      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name).sort()).toEqual(["ai", "tech"]);
    });

    it("adds tag to document", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Test",
        origin_type: "subscription",
      });

      const tag = await createTag(env.FOCUS_DB, { name: "newsletter" });
      await addTagToDocument(env.FOCUS_DB, doc.id, tag.id);

      const result = await env.FOCUS_DB.prepare(
        "SELECT * FROM document_tags WHERE document_id = ?1 AND tag_id = ?2"
      )
        .bind(doc.id, tag.id)
        .first();
      expect(result).not.toBeNull();
    });

    it("handles duplicate tag-to-document gracefully", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Test",
        origin_type: "subscription",
      });

      const tag = await createTag(env.FOCUS_DB, { name: "newsletter" });
      await addTagToDocument(env.FOCUS_DB, doc.id, tag.id);
      await addTagToDocument(env.FOCUS_DB, doc.id, tag.id);
    });
  });

  describe("ingestion log", () => {
    it("logs a successful ingestion event", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Test",
        origin_type: "subscription",
      });

      const log = await logIngestionEvent(env.FOCUS_DB, {
        event_id: "evt-001",
        document_id: doc.id,
        channel_type: "email",
        status: "success",
      });

      expect(log.event_id).toBe("evt-001");
      expect(log.status).toBe("success");
      expect(log.channel_type).toBe("email");
    });

    it("logs a failed ingestion event", async () => {
      const log = await logIngestionEvent(env.FOCUS_DB, {
        event_id: "evt-002",
        channel_type: "email",
        status: "failure",
        error_code: "PARSE_ERROR",
        error_detail: "Failed to parse MIME",
        attempts: 3,
      });

      expect(log.status).toBe("failure");
      expect(log.error_code).toBe("PARSE_ERROR");
      expect(log.attempts).toBe(3);
    });
  });

  describe("denylist", () => {
    it("detects denied domain", async () => {
      await env.FOCUS_DB.exec(
        "INSERT INTO denylist (id, domain, reason) VALUES ('d1', 'spam.com', 'spam')"
      );

      expect(await isDomainDenied(env.FOCUS_DB, "spam.com")).toBe(true);
      expect(await isDomainDenied(env.FOCUS_DB, "legit.com")).toBe(false);
    });

    it("is case-insensitive", async () => {
      await env.FOCUS_DB.exec(
        "INSERT INTO denylist (id, domain, reason) VALUES ('d2', 'spam.com', 'spam')"
      );

      expect(await isDomainDenied(env.FOCUS_DB, "SPAM.COM")).toBe(true);
    });
  });

  describe("attachments", () => {
    it("creates an attachment record", async () => {
      const doc = await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Test",
        origin_type: "subscription",
      });

      const att = await createAttachment(env.FOCUS_DB, {
        document_id: doc.id,
        filename: "image.png",
        content_type: "image/png",
        size_bytes: 1024,
        content_id: "img001",
        storage_key: "attachments/doc1/img001",
      });

      expect(att.filename).toBe("image.png");
      expect(att.content_id).toBe("img001");
      expect(att.storage_key).toBe("attachments/doc1/img001");
    });
  });
});
