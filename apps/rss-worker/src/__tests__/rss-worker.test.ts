import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { INITIAL_SCHEMA_SQL, FTS5_MIGRATION_SQL, MULTI_TENANCY_SQL } from "@focus-reader/db/migration-sql";
import { createFeed, createTag, addTagToFeed, scopeDb } from "@focus-reader/db";
import type { UserScopedDb } from "@focus-reader/db";
import worker from "../index.js";
import type { Env } from "../index.js";

// --- RSS fixture ---

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <link>https://testblog.example.com</link>
    <item>
      <title>Post One</title>
      <link>https://testblog.example.com/post-1</link>
      <guid>post-001</guid>
      <description>First post content</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Post Two</title>
      <link>https://testblog.example.com/post-2</link>
      <guid>post-002</guid>
      <description>Second post content</description>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const EMPTY_RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Blog</title>
    <link>https://emptyblog.example.com</link>
  </channel>
</rss>`;

// --- Test helpers ---

const TEST_USER_ID = "test-user-00000000-0000-0000-0001";

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
  "ingestion_report_daily",
  "document",
  "subscription",
  "tag",
  "feed",
  "collection",
  "feed_token",
  "api_key",
  "saved_view",
  "user_preferences",
  "denylist",
  "user",
];

async function resetDatabase(db: D1Database) {
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

  // Create test user
  await db
    .prepare("INSERT INTO user (id, email, slug, is_admin) VALUES (?1, ?2, ?3, 1)")
    .bind(TEST_USER_ID, "test@example.com", "test")
    .run();
}

function getCtx(): UserScopedDb {
  return scopeDb(env.FOCUS_DB, TEST_USER_ID);
}

function getEnv(): Env {
  return {
    FOCUS_DB: env.FOCUS_DB,
  };
}

const fakeController = {
  scheduledTime: Date.now(),
  cron: "*/15 * * * *",
  noRetry() {},
} as ScheduledController;

const fakeCtx: ExecutionContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  abort: () => {},
  props: {},
};

// --- Tests ---

describe("rss worker", () => {
  beforeEach(async () => {
    await resetDatabase(env.FOCUS_DB);
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => {
    fetchMock.deactivate();
  });

  it("creates documents from feed items (happy path)", async () => {
    const ctx = getCtx();
    // Seed a feed that is due for polling (no last_fetched_at)
    const feed = await createFeed(ctx, {
      feed_url: "https://testblog.example.com/feed.xml",
      title: "Test Blog",
    });

    // Mock the feed fetch
    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, RSS_FIXTURE, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Verify 2 documents were created
    const docs = await env.FOCUS_DB.prepare(
      "SELECT * FROM document WHERE type = 'rss' ORDER BY title ASC"
    ).all<Record<string, unknown>>();

    expect(docs.results).toHaveLength(2);

    const doc1 = docs.results[0];
    expect(doc1.title).toBe("Post One");
    expect(doc1.type).toBe("rss");
    expect(doc1.origin_type).toBe("feed");
    expect(doc1.source_id).toBe(feed.id);
    expect(doc1.location).toBe("inbox");
    expect(doc1.url).toBe("https://testblog.example.com/post-1");

    const doc2 = docs.results[1];
    expect(doc2.title).toBe("Post Two");

    // Verify feed was marked fetched
    const updatedFeed = await env.FOCUS_DB.prepare(
      "SELECT * FROM feed WHERE id = ?1"
    )
      .bind(feed.id)
      .first<Record<string, unknown>>();
    expect(updatedFeed!.last_fetched_at).not.toBeNull();
    expect(updatedFeed!.error_count).toBe(0);

    // Verify ingestion log entries
    const logs = await env.FOCUS_DB.prepare(
      "SELECT * FROM ingestion_log WHERE channel_type = 'rss' AND status = 'success'"
    ).all<Record<string, unknown>>();
    expect(logs.results).toHaveLength(2);
  });

  it("deduplicates items across multiple runs", async () => {
    const ctx = getCtx();
    const feed = await createFeed(ctx, {
      feed_url: "https://testblog.example.com/feed.xml",
      title: "Test Blog",
    });

    // Mock for first run
    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, RSS_FIXTURE, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Reset last_fetched_at so feed is polled again
    await env.FOCUS_DB.prepare(
      "UPDATE feed SET last_fetched_at = NULL WHERE id = ?1"
    )
      .bind(feed.id)
      .run();

    // Mock for second run
    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, RSS_FIXTURE, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Should still have only 2 documents
    const count = await env.FOCUS_DB.prepare(
      "SELECT COUNT(*) as cnt FROM document WHERE type = 'rss'"
    ).first<{ cnt: number }>();
    expect(count!.cnt).toBe(2);
  });

  it("increments error count on feed fetch failure", async () => {
    const ctx = getCtx();
    const feed = await createFeed(ctx, {
      feed_url: "https://testblog.example.com/feed.xml",
      title: "Test Blog",
    });

    // Mock a 500 error
    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(500, "Internal Server Error");

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Verify error count incremented
    const updatedFeed = await env.FOCUS_DB.prepare(
      "SELECT * FROM feed WHERE id = ?1"
    )
      .bind(feed.id)
      .first<Record<string, unknown>>();
    expect(updatedFeed!.error_count).toBe(1);
    expect(updatedFeed!.last_error).toBeTruthy();

    // No documents should be created
    const count = await env.FOCUS_DB.prepare(
      "SELECT COUNT(*) as cnt FROM document WHERE type = 'rss'"
    ).first<{ cnt: number }>();
    expect(count!.cnt).toBe(0);
  });

  it("auto-deactivates feed after max consecutive errors", async () => {
    const ctx = getCtx();
    // Seed feed with error_count = 4 (one away from threshold of 5)
    const feed = await createFeed(ctx, {
      feed_url: "https://testblog.example.com/feed.xml",
      title: "Test Blog",
    });
    await env.FOCUS_DB.prepare(
      "UPDATE feed SET error_count = 4 WHERE id = ?1"
    )
      .bind(feed.id)
      .run();

    // Mock a 500 error
    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(500, "Internal Server Error");

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Verify feed is now deactivated
    const updatedFeed = await env.FOCUS_DB.prepare(
      "SELECT * FROM feed WHERE id = ?1"
    )
      .bind(feed.id)
      .first<Record<string, unknown>>();
    expect(updatedFeed!.is_active).toBe(0);
    expect(updatedFeed!.error_count).toBe(5);
  });

  it("inherits tags from feed to documents", async () => {
    const ctx = getCtx();
    const feed = await createFeed(ctx, {
      feed_url: "https://testblog.example.com/feed.xml",
      title: "Test Blog",
    });

    const tag1 = await createTag(ctx, { name: "tech" });
    const tag2 = await createTag(ctx, { name: "news" });
    await addTagToFeed(ctx, feed.id, tag1.id);
    await addTagToFeed(ctx, feed.id, tag2.id);

    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, RSS_FIXTURE, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Get all documents
    const docs = await env.FOCUS_DB.prepare(
      "SELECT id FROM document WHERE type = 'rss'"
    ).all<{ id: string }>();

    for (const doc of docs.results) {
      const docTags = await env.FOCUS_DB.prepare(
        "SELECT tag_id FROM document_tags WHERE document_id = ?1"
      )
        .bind(doc.id)
        .all<{ tag_id: string }>();

      const tagIds = docTags.results.map((r) => r.tag_id).sort();
      expect(tagIds).toHaveLength(2);
      expect(tagIds).toContain(tag1.id);
      expect(tagIds).toContain(tag2.id);
    }
  });

  it("handles empty feed with no items", async () => {
    const ctx = getCtx();
    const feed = await createFeed(ctx, {
      feed_url: "https://emptyblog.example.com/feed.xml",
      title: "Empty Blog",
    });

    fetchMock
      .get("https://emptyblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, EMPTY_RSS_FIXTURE, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // No documents should be created
    const count = await env.FOCUS_DB.prepare(
      "SELECT COUNT(*) as cnt FROM document WHERE type = 'rss'"
    ).first<{ cnt: number }>();
    expect(count!.cnt).toBe(0);

    // Feed should be marked as fetched (no errors)
    const updatedFeed = await env.FOCUS_DB.prepare(
      "SELECT * FROM feed WHERE id = ?1"
    )
      .bind(feed.id)
      .first<Record<string, unknown>>();
    expect(updatedFeed!.last_fetched_at).not.toBeNull();
    expect(updatedFeed!.error_count).toBe(0);
  });

  it("deduplicates via URL normalization (tracking params, trailing slash)", async () => {
    const ctx = getCtx();
    const feed = await createFeed(ctx, {
      feed_url: "https://testblog.example.com/feed.xml",
      title: "Test Blog",
    });

    // First run: items with clean URLs
    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, RSS_FIXTURE, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Verify 2 documents created
    const countBefore = await env.FOCUS_DB.prepare(
      "SELECT COUNT(*) as cnt FROM document WHERE type = 'rss'"
    ).first<{ cnt: number }>();
    expect(countBefore!.cnt).toBe(2);

    // Reset last_fetched_at so feed is polled again
    await env.FOCUS_DB.prepare(
      "UPDATE feed SET last_fetched_at = NULL WHERE id = ?1"
    )
      .bind(feed.id)
      .run();

    // Second run: same URLs but with tracking params and trailing slashes
    const RSS_WITH_TRACKING = RSS_FIXTURE
      .replace(
        "https://testblog.example.com/post-1",
        "https://testblog.example.com/post-1/?utm_source=rss&utm_medium=feed"
      )
      .replace(
        "https://testblog.example.com/post-2",
        "https://testblog.example.com/post-2?fbclid=abc123"
      );

    fetchMock
      .get("https://testblog.example.com")
      .intercept({ path: "/feed.xml" })
      .reply(200, RSS_WITH_TRACKING, {
        headers: { "Content-Type": "application/rss+xml" },
      });

    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // Should still be 2 documents — tracking params and trailing slash stripped
    const countAfter = await env.FOCUS_DB.prepare(
      "SELECT COUNT(*) as cnt FROM document WHERE type = 'rss'"
    ).first<{ cnt: number }>();
    expect(countAfter!.cnt).toBe(2);
  });

  it("skips inactive and recently-fetched feeds", async () => {
    const ctx = getCtx();
    // Inactive feed
    const inactiveFeed = await createFeed(ctx, {
      feed_url: "https://inactive.example.com/feed.xml",
      title: "Inactive Feed",
    });
    await env.FOCUS_DB.prepare(
      "UPDATE feed SET is_active = 0 WHERE id = ?1"
    )
      .bind(inactiveFeed.id)
      .run();

    // Recently-fetched feed (fetched just now, interval is 60 min default)
    const recentFeed = await createFeed(ctx, {
      feed_url: "https://recent.example.com/feed.xml",
      title: "Recent Feed",
    });
    await env.FOCUS_DB.prepare(
      "UPDATE feed SET last_fetched_at = datetime('now') WHERE id = ?1"
    )
      .bind(recentFeed.id)
      .run();

    const testEnv = getEnv();
    await worker.scheduled(fakeController, testEnv, fakeCtx);

    // No documents should be created (neither feed should be polled)
    const count = await env.FOCUS_DB.prepare(
      "SELECT COUNT(*) as cnt FROM document WHERE type = 'rss'"
    ).first<{ cnt: number }>();
    expect(count!.cnt).toBe(0);
  });
});
