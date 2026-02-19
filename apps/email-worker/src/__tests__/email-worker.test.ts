import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL, MULTI_TENANCY_SQL } from "@focus-reader/db/migration-sql";
import {
  createSubscription,
  createTag,
  getSubscriptionByEmail,
  scopeDb,
} from "@focus-reader/db";
import type { UserScopedDb } from "@focus-reader/db";
import worker from "../index.js";
import type { Env } from "../index.js";

// --- Embedded EML fixtures (workerd can't read from filesystem) ---

const SIMPLE_NEWSLETTER_EML = `From: Morning Brew <newsletter@morningbrew.com>
To: morning-brew@read.example.com
Subject: Daily Digest - Feb 13
Date: Thu, 13 Feb 2026 08:00:00 -0500
Message-ID: <msg001@morningbrew.com>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset="UTF-8"

Good morning! Here is your daily digest.

Top Stories:
1. Markets are up
2. Tech earnings beat expectations

--boundary123
Content-Type: text/html; charset="UTF-8"

<html>
<body>
<h1>Good morning!</h1>
<p>Here is your daily digest.</p>
<h2>Top Stories</h2>
<ol>
<li>Markets are up</li>
<li>Tech earnings beat expectations</li>
</ol>
<img src="https://example.com/hero.jpg" alt="Hero" />
</body>
</html>

--boundary123--
`;

const CONFIRMATION_EML = `From: noreply@newsletter.example.com
To: test-sub@read.example.com
Subject: Please confirm your subscription
Date: Thu, 13 Feb 2026 09:00:00 -0500
Message-ID: <confirm001@newsletter.example.com>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="confirm-boundary"

--confirm-boundary
Content-Type: text/plain; charset="UTF-8"

Please click below to confirm your email subscription.

Confirm: https://newsletter.example.com/confirm?token=abc123

--confirm-boundary
Content-Type: text/html; charset="UTF-8"

<html>
<body>
<h1>Confirm Your Subscription</h1>
<p>Please click the link below to confirm your email address:</p>
<a href="https://newsletter.example.com/confirm?token=abc123">Confirm your email</a>
</body>
</html>

--confirm-boundary--
`;

const EMPTY_BODY_EML = `From: sender@example.com
To: test@read.example.com
Subject: Empty email
Date: Thu, 13 Feb 2026 12:00:00 -0500
Message-ID: <empty001@example.com>
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"

`;

// 1x1 transparent PNG as base64
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const CID_IMAGE_EML = `From: Design Weekly <newsletter@designweekly.com>
To: design-weekly@read.example.com
Subject: This Week in Design
Date: Thu, 13 Feb 2026 10:00:00 -0500
Message-ID: <design001@designweekly.com>
MIME-Version: 1.0
Content-Type: multipart/related; boundary="related-boundary"

--related-boundary
Content-Type: multipart/alternative; boundary="alt-boundary"

--alt-boundary
Content-Type: text/plain; charset="UTF-8"

This week in design: great things happened.

--alt-boundary
Content-Type: text/html; charset="UTF-8"

<html>
<body>
<h1>This Week in Design</h1>
<p>Check out this amazing illustration:</p>
<img src="cid:hero-image@designweekly" alt="Hero Illustration" />
<p>More content below.</p>
</body>
</html>

--alt-boundary--

--related-boundary
Content-Type: image/png
Content-Transfer-Encoding: base64
Content-ID: <hero-image@designweekly>
Content-Disposition: inline; filename="hero.png"

${TINY_PNG_B64}

--related-boundary--
`;

// --- Mock ForwardableEmailMessage ---

function createMockMessage(
  emlContent: string,
  overrides?: { from?: string; to?: string }
): ForwardableEmailMessage {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(emlContent);

  // Parse From/To from EML headers for defaults
  const fromMatch = emlContent.match(/^From:\s*(?:.*<)?([^>\s]+)>?/m);
  const toMatch = emlContent.match(/^To:\s*(?:.*<)?([^>\s]+)>?/m);

  return {
    from: overrides?.from ?? fromMatch?.[1] ?? "unknown@example.com",
    to: overrides?.to ?? toMatch?.[1] ?? "test@read.example.com",
    raw: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    rawSize: bytes.byteLength,
    headers: new Headers(),
    setReject(_reason: string) {},
    forward(_email: string, _headers?: Headers) {
      return Promise.resolve();
    },
    reply(_message: EmailMessage) {
      return Promise.resolve();
    },
  } as ForwardableEmailMessage;
}

// --- Test helpers ---

const TABLES = [
  "document_fts",
  "document_tags",
  "subscription_tags",
  "feed_tags",
  "highlight_tags",
  "collection_documents",
  "attachment",
  "document_email_meta",
  "document_pdf_meta",
  "highlight",
  "ingestion_log",
  "document",
  "subscription",
  "tag",
  "feed",
  "collection",
  "feed_token",
  "api_key",
  "saved_view",
  "user_preferences",
  "ingestion_report_daily",
  "denylist",
  "user",
];

async function resetDatabase(db: D1Database) {
  // Drop all tables in dependency order, then re-apply migration
  for (const table of TABLES) {
    await db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  }

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

async function clearR2(bucket: R2Bucket) {
  const listed = await bucket.list();
  for (const obj of listed.objects) {
    await bucket.delete(obj.key);
  }
}

function getEnv(): Env {
  return {
    FOCUS_DB: env.FOCUS_DB,
    FOCUS_STORAGE: env.FOCUS_STORAGE,
    EMAIL_DOMAIN: "read.example.com",
    COLLAPSE_PLUS_ALIAS: "false",
  };
}

/**
 * Get a UserScopedDb context for the auto-created owner user.
 * The email worker creates this user via getOrCreateSingleUser on first email.
 * For test setup (pre-creating subscriptions/tags), we resolve the user first.
 */
async function getTestCtx(): Promise<UserScopedDb> {
  // Ensure the owner user exists (same logic as resolveUserId in the worker)
  let user = await env.FOCUS_DB.prepare("SELECT id FROM user LIMIT 1").first<{ id: string }>();
  if (!user) {
    const id = crypto.randomUUID();
    await env.FOCUS_DB.prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 1)")
      .bind(id, "owner@localhost", "owner")
      .run();
    user = { id };
  }
  return scopeDb(env.FOCUS_DB, user.id);
}

const fakeCtx: ExecutionContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  abort: () => {},
  props: {},
};

// --- Tests ---

describe("email worker", () => {
  beforeEach(async () => {
    await resetDatabase(env.FOCUS_DB);
    await clearR2(env.FOCUS_STORAGE);
  });

  describe("happy path end-to-end", () => {
    it("creates document, email meta, subscription, and ingestion log", async () => {
      const testEnv = getEnv();
      const message = createMockMessage(SIMPLE_NEWSLETTER_EML);

      await worker.email(message, testEnv, fakeCtx);

      // Verify document was created
      const doc = await env.FOCUS_DB.prepare(
        "SELECT * FROM document WHERE type = 'email' ORDER BY saved_at DESC LIMIT 1"
      ).first<Record<string, unknown>>();

      expect(doc).not.toBeNull();
      expect(doc!.title).toBe("Daily Digest - Feb 13");
      expect(doc!.type).toBe("email");
      expect(doc!.location).toBe("inbox");
      expect(doc!.origin_type).toBe("subscription");
      expect(doc!.author).toBe("Morning Brew");
      expect(doc!.word_count).toBeGreaterThan(0);
      expect(doc!.reading_time_minutes).toBeGreaterThanOrEqual(1);
      expect(doc!.html_content).toBeTruthy();
      expect(doc!.markdown_content).toBeTruthy();
      expect(doc!.plain_text_content).toBeTruthy();

      // Verify email meta
      const meta = await env.FOCUS_DB.prepare(
        "SELECT * FROM document_email_meta WHERE document_id = ?1"
      )
        .bind(doc!.id)
        .first<Record<string, unknown>>();

      expect(meta).not.toBeNull();
      expect(meta!.message_id).toBe("msg001@morningbrew.com");
      expect(meta!.from_address).toBe("newsletter@morningbrew.com");
      expect(meta!.from_name).toBe("Morning Brew");
      expect(meta!.is_rejected).toBe(0);
      expect(meta!.needs_confirmation).toBe(0);
      expect(meta!.delivery_attempts).toBe(1);
      expect(meta!.fingerprint).toBeTruthy();

      // Verify subscription was auto-created
      const ctx = await getTestCtx();
      const sub = await getSubscriptionByEmail(
        ctx,
        "morning-brew@read.example.com"
      );
      expect(sub).not.toBeNull();
      expect(sub!.display_name).toBe("Morning Brew");
      expect(sub!.sender_address).toBe("newsletter@morningbrew.com");

      // Verify document references subscription
      expect(doc!.source_id).toBe(sub!.id);

      // Verify ingestion log
      const log = await env.FOCUS_DB.prepare(
        "SELECT * FROM ingestion_log WHERE document_id = ?1"
      )
        .bind(doc!.id)
        .first<Record<string, unknown>>();

      expect(log).not.toBeNull();
      expect(log!.status).toBe("success");
      expect(log!.channel_type).toBe("email");
    });
  });

  describe("CID image persistence", () => {
    it("uploads CID images to R2 and rewrites HTML", async () => {
      const testEnv = getEnv();
      const message = createMockMessage(CID_IMAGE_EML);

      await worker.email(message, testEnv, fakeCtx);

      // Get the created document
      const doc = await env.FOCUS_DB.prepare(
        "SELECT * FROM document WHERE title = 'This Week in Design'"
      ).first<Record<string, unknown>>();

      expect(doc).not.toBeNull();
      const documentId = doc!.id as string;

      // Verify R2 object was created
      const r2Key = `attachments/${documentId}/hero-image@designweekly`;
      const r2Object = await env.FOCUS_STORAGE.get(r2Key);
      expect(r2Object).not.toBeNull();

      // Verify HTML was rewritten to use proxy URLs
      const htmlContent = doc!.html_content as string;
      expect(htmlContent).toContain(
        `/api/attachments/${documentId}/hero-image@designweekly`
      );
      expect(htmlContent).not.toContain("cid:");

      // Verify attachment record was created with storage_key
      const att = await env.FOCUS_DB.prepare(
        "SELECT * FROM attachment WHERE document_id = ?1 AND content_id = ?2"
      )
        .bind(documentId, "hero-image@designweekly")
        .first<Record<string, unknown>>();

      expect(att).not.toBeNull();
      expect(att!.storage_key).toBe(r2Key);
      expect(att!.content_type).toBe("image/png");
    });
  });

  describe("CID upload failure resilience", () => {
    it("creates document even when R2 upload fails", async () => {
      const testEnv = getEnv();

      // Replace FOCUS_STORAGE with a failing R2 mock
      const failingStorage = {
        ...env.FOCUS_STORAGE,
        put: () => {
          throw new Error("R2 simulated failure");
        },
        get: env.FOCUS_STORAGE.get.bind(env.FOCUS_STORAGE),
        delete: env.FOCUS_STORAGE.delete.bind(env.FOCUS_STORAGE),
        list: env.FOCUS_STORAGE.list.bind(env.FOCUS_STORAGE),
      } as unknown as R2Bucket;

      const failEnv: Env = { ...testEnv, FOCUS_STORAGE: failingStorage };
      const message = createMockMessage(CID_IMAGE_EML);

      await worker.email(message, failEnv, fakeCtx);

      // Document should still be created
      const doc = await env.FOCUS_DB.prepare(
        "SELECT * FROM document WHERE title = 'This Week in Design'"
      ).first<Record<string, unknown>>();

      expect(doc).not.toBeNull();
      expect(doc!.html_content).toBeTruthy();

      // HTML should still have the original cid: reference (not rewritten)
      // since the upload failed and cidMap is empty
      const htmlContent = doc!.html_content as string;
      expect(htmlContent).toContain("cid:");

      // R2 should be empty (upload failed)
      const listed = await env.FOCUS_STORAGE.list();
      expect(listed.objects).toHaveLength(0);

      // Attachment record should exist but without storage_key
      const att = await env.FOCUS_DB.prepare(
        "SELECT * FROM attachment WHERE document_id = ?1 AND content_id = ?2"
      )
        .bind(doc!.id as string, "hero-image@designweekly")
        .first<Record<string, unknown>>();

      expect(att).not.toBeNull();
      expect(att!.storage_key).toBeNull();

      // Ingestion log should show success (document was still created)
      const log = await env.FOCUS_DB.prepare(
        "SELECT * FROM ingestion_log WHERE document_id = ?1"
      )
        .bind(doc!.id)
        .first<Record<string, unknown>>();
      expect(log).not.toBeNull();
      expect(log!.status).toBe("success");
    });
  });

  describe("deduplication", () => {
    it("deduplicates by Message-ID", async () => {
      const testEnv = getEnv();

      // First ingestion
      const message1 = createMockMessage(SIMPLE_NEWSLETTER_EML);
      await worker.email(message1, testEnv, fakeCtx);

      // Second ingestion of same email
      const message2 = createMockMessage(SIMPLE_NEWSLETTER_EML);
      await worker.email(message2, testEnv, fakeCtx);

      // Should have only 1 document
      const docs = await env.FOCUS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM document WHERE type = 'email'"
      ).first<{ cnt: number }>();
      expect(docs!.cnt).toBe(1);

      // delivery_attempts should be 2
      const meta = await env.FOCUS_DB.prepare(
        "SELECT * FROM document_email_meta WHERE message_id = 'msg001@morningbrew.com'"
      ).first<Record<string, unknown>>();
      expect(meta!.delivery_attempts).toBe(2);

      // Should have 2 ingestion log entries (both successful)
      const logs = await env.FOCUS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM ingestion_log WHERE status = 'success'"
      ).first<{ cnt: number }>();
      expect(logs!.cnt).toBe(2);
    });
  });

  describe("empty body rejection", () => {
    it("creates document with is_rejected = 1", async () => {
      const testEnv = getEnv();
      const message = createMockMessage(EMPTY_BODY_EML);

      await worker.email(message, testEnv, fakeCtx);

      // Document should still be created
      const doc = await env.FOCUS_DB.prepare(
        "SELECT * FROM document WHERE title = 'Empty email'"
      ).first<Record<string, unknown>>();

      expect(doc).not.toBeNull();

      // Email meta should show rejection
      const meta = await env.FOCUS_DB.prepare(
        "SELECT * FROM document_email_meta WHERE document_id = ?1"
      )
        .bind(doc!.id)
        .first<Record<string, unknown>>();

      expect(meta).not.toBeNull();
      expect(meta!.is_rejected).toBe(1);
      expect(meta!.rejection_reason).toBe("empty_body");
    });
  });

  describe("confirmation detection", () => {
    it("sets needs_confirmation = 1", async () => {
      const testEnv = getEnv();
      const message = createMockMessage(CONFIRMATION_EML);

      await worker.email(message, testEnv, fakeCtx);

      const doc = await env.FOCUS_DB.prepare(
        "SELECT * FROM document WHERE title = 'Please confirm your subscription'"
      ).first<Record<string, unknown>>();

      expect(doc).not.toBeNull();

      const meta = await env.FOCUS_DB.prepare(
        "SELECT * FROM document_email_meta WHERE document_id = ?1"
      )
        .bind(doc!.id)
        .first<Record<string, unknown>>();

      expect(meta).not.toBeNull();
      expect(meta!.needs_confirmation).toBe(1);
    });
  });

  describe("auto-create subscription", () => {
    it("creates subscription on first email to new address", async () => {
      const testEnv = getEnv();
      const message = createMockMessage(SIMPLE_NEWSLETTER_EML);

      // No subscription exists yet
      const ctx = await getTestCtx();
      const before = await getSubscriptionByEmail(
        ctx,
        "morning-brew@read.example.com"
      );
      expect(before).toBeNull();

      await worker.email(message, testEnv, fakeCtx);

      const after = await getSubscriptionByEmail(
        ctx,
        "morning-brew@read.example.com"
      );
      expect(after).not.toBeNull();
      expect(after!.display_name).toBe("Morning Brew");
      expect(after!.is_active).toBe(1);
    });

    it("reuses existing subscription on subsequent emails", async () => {
      const testEnv = getEnv();

      // Pre-create a subscription
      const ctx = await getTestCtx();
      const sub = await createSubscription(ctx, {
        pseudo_email: "morning-brew@read.example.com",
        display_name: "My Morning Brew",
        sender_address: "newsletter@morningbrew.com",
      });

      // Send an email to that address (different Message-ID to avoid dedup)
      const emlWithDifferentId = SIMPLE_NEWSLETTER_EML.replace(
        "msg001@morningbrew.com",
        "msg999@morningbrew.com"
      );
      const message = createMockMessage(emlWithDifferentId);
      await worker.email(message, testEnv, fakeCtx);

      // Should still have only 1 subscription
      const count = await env.FOCUS_DB.prepare(
        "SELECT COUNT(*) as cnt FROM subscription"
      ).first<{ cnt: number }>();
      expect(count!.cnt).toBe(1);

      // Document should reference existing subscription
      const doc = await env.FOCUS_DB.prepare(
        "SELECT source_id FROM document ORDER BY saved_at DESC LIMIT 1"
      ).first<{ source_id: string }>();
      expect(doc!.source_id).toBe(sub.id);
    });
  });

  describe("tag inheritance", () => {
    it("inherits tags from subscription", async () => {
      const testEnv = getEnv();

      // Pre-create subscription with tags
      const ctx = await getTestCtx();
      const sub = await createSubscription(ctx, {
        pseudo_email: "morning-brew@read.example.com",
        display_name: "Morning Brew",
      });

      const tag1 = await createTag(ctx, { name: "finance" });
      const tag2 = await createTag(ctx, { name: "daily" });

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

      const message = createMockMessage(SIMPLE_NEWSLETTER_EML);
      await worker.email(message, testEnv, fakeCtx);

      // Get the document
      const doc = await env.FOCUS_DB.prepare(
        "SELECT id FROM document ORDER BY saved_at DESC LIMIT 1"
      ).first<{ id: string }>();

      // Document should have both tags
      const docTags = await env.FOCUS_DB.prepare(
        "SELECT tag_id FROM document_tags WHERE document_id = ?1"
      )
        .bind(doc!.id)
        .all<{ tag_id: string }>();

      const tagIds = docTags.results.map((r) => r.tag_id).sort();
      expect(tagIds).toHaveLength(2);
      expect(tagIds).toContain(tag1.id);
      expect(tagIds).toContain(tag2.id);
    });
  });
});
