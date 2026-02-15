import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  createFeed,
  getFeed,
  getFeedByUrl,
  listFeeds,
  updateFeed,
  softDeleteFeed,
  hardDeleteFeed,
  getActiveFeeds,
  markFeedFetched,
  incrementFeedError,
  resetFeedErrors,
  getFeedsDueForPoll,
} from "../queries/feeds.js";
import {
  createTag,
  deleteTag,
  addTagToFeed,
  removeTagFromFeed,
  getTagsForFeed,
} from "../queries/tags.js";
import { createDocument, listDocuments } from "../queries/documents.js";
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

describe("feed queries", () => {
  beforeEach(async () => {
    await applyMigration(env.FOCUS_DB);
  });

  describe("createFeed + getFeed", () => {
    it("creates and retrieves a feed", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Example Feed",
        site_url: "https://example.com",
        description: "An example feed",
        icon_url: "https://example.com/icon.png",
      });

      expect(feed.id).toBeDefined();
      expect(feed.feed_url).toBe("https://example.com/feed.xml");
      expect(feed.title).toBe("Example Feed");
      expect(feed.site_url).toBe("https://example.com");
      expect(feed.description).toBe("An example feed");
      expect(feed.icon_url).toBe("https://example.com/icon.png");
      expect(feed.is_active).toBe(1);
      expect(feed.fetch_interval_minutes).toBe(60);
      expect(feed.error_count).toBe(0);
      expect(feed.last_error).toBeNull();
      expect(feed.deleted_at).toBeNull();

      const fetched = await getFeed(env.FOCUS_DB, feed.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe("Example Feed");
    });

    it("creates feed with custom id", async () => {
      const customId = crypto.randomUUID();
      const feed = await createFeed(env.FOCUS_DB, {
        id: customId,
        feed_url: "https://example.com/feed2.xml",
        title: "Custom ID Feed",
      });
      expect(feed.id).toBe(customId);
    });
  });

  describe("getFeedByUrl", () => {
    it("finds feed by URL", async () => {
      await createFeed(env.FOCUS_DB, {
        feed_url: "https://blog.example.com/rss",
        title: "Blog Feed",
      });

      const found = await getFeedByUrl(env.FOCUS_DB, "https://blog.example.com/rss");
      expect(found).not.toBeNull();
      expect(found!.title).toBe("Blog Feed");
    });

    it("returns null for unknown URL", async () => {
      const found = await getFeedByUrl(env.FOCUS_DB, "https://nonexistent.com/feed");
      expect(found).toBeNull();
    });
  });

  describe("listFeeds", () => {
    it("returns feeds with stats", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Stats Feed",
      });

      // Create documents linked to feed
      await createDocument(env.FOCUS_DB, {
        type: "rss",
        title: "RSS Doc 1",
        origin_type: "feed",
        source_id: feed.id,
      });
      await createDocument(env.FOCUS_DB, {
        type: "rss",
        title: "RSS Doc 2",
        origin_type: "feed",
        source_id: feed.id,
      });

      const feeds = await listFeeds(env.FOCUS_DB);
      expect(feeds).toHaveLength(1);
      expect(feeds[0].title).toBe("Stats Feed");
      expect(feeds[0].documentCount).toBe(2);
      expect(feeds[0].unreadCount).toBe(2);
    });

    it("excludes soft-deleted feeds", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Will Delete",
      });
      await softDeleteFeed(env.FOCUS_DB, feed.id);

      const feeds = await listFeeds(env.FOCUS_DB);
      expect(feeds).toHaveLength(0);
    });
  });

  describe("updateFeed", () => {
    it("updates title, interval, and other fields", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Original Title",
      });

      await updateFeed(env.FOCUS_DB, feed.id, {
        title: "Updated Title",
        fetch_interval_minutes: 30,
        description: "Now with description",
      });

      const updated = await getFeed(env.FOCUS_DB, feed.id);
      expect(updated!.title).toBe("Updated Title");
      expect(updated!.fetch_interval_minutes).toBe(30);
      expect(updated!.description).toBe("Now with description");
    });
  });

  describe("softDeleteFeed", () => {
    it("sets deleted_at", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "To Delete",
      });

      await softDeleteFeed(env.FOCUS_DB, feed.id);

      const deleted = await getFeed(env.FOCUS_DB, feed.id);
      expect(deleted!.deleted_at).not.toBeNull();
    });
  });

  describe("hardDeleteFeed", () => {
    it("removes feed and feed_tags", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Hard Delete",
      });
      const tag = await createTag(env.FOCUS_DB, { name: "tech" });
      await addTagToFeed(env.FOCUS_DB, feed.id, tag.id);

      await hardDeleteFeed(env.FOCUS_DB, feed.id);

      const deleted = await getFeed(env.FOCUS_DB, feed.id);
      expect(deleted).toBeNull();

      const tags = await getTagsForFeed(env.FOCUS_DB, feed.id);
      expect(tags).toHaveLength(0);
    });
  });

  describe("markFeedFetched", () => {
    it("updates last_fetched_at and resets errors", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Fetch Me",
      });

      // First add some errors
      await incrementFeedError(env.FOCUS_DB, feed.id, "timeout");
      await incrementFeedError(env.FOCUS_DB, feed.id, "timeout again");

      const errored = await getFeed(env.FOCUS_DB, feed.id);
      expect(errored!.error_count).toBe(2);

      await markFeedFetched(env.FOCUS_DB, feed.id);

      const fetched = await getFeed(env.FOCUS_DB, feed.id);
      expect(fetched!.last_fetched_at).not.toBeNull();
      expect(fetched!.error_count).toBe(0);
      expect(fetched!.last_error).toBeNull();
    });
  });

  describe("incrementFeedError", () => {
    it("increments error_count and sets last_error", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Error Feed",
      });

      await incrementFeedError(env.FOCUS_DB, feed.id, "Connection refused");

      const updated = await getFeed(env.FOCUS_DB, feed.id);
      expect(updated!.error_count).toBe(1);
      expect(updated!.last_error).toBe("Connection refused");

      await incrementFeedError(env.FOCUS_DB, feed.id, "Timeout");

      const updated2 = await getFeed(env.FOCUS_DB, feed.id);
      expect(updated2!.error_count).toBe(2);
      expect(updated2!.last_error).toBe("Timeout");
    });
  });

  describe("resetFeedErrors", () => {
    it("resets error_count and last_error", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Reset Errors",
      });

      await incrementFeedError(env.FOCUS_DB, feed.id, "Some error");
      await resetFeedErrors(env.FOCUS_DB, feed.id);

      const reset = await getFeed(env.FOCUS_DB, feed.id);
      expect(reset!.error_count).toBe(0);
      expect(reset!.last_error).toBeNull();
    });
  });

  describe("getActiveFeeds", () => {
    it("returns only active, non-deleted feeds", async () => {
      const active = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/active.xml",
        title: "Active Feed",
      });
      const inactive = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/inactive.xml",
        title: "Inactive Feed",
      });
      await updateFeed(env.FOCUS_DB, inactive.id, { is_active: 0 });

      const deleted = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/deleted.xml",
        title: "Deleted Feed",
      });
      await softDeleteFeed(env.FOCUS_DB, deleted.id);

      const feeds = await getActiveFeeds(env.FOCUS_DB);
      expect(feeds).toHaveLength(1);
      expect(feeds[0].id).toBe(active.id);
    });
  });

  describe("getFeedsDueForPoll", () => {
    it("returns active feeds that have never been fetched", async () => {
      await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/never-fetched.xml",
        title: "Never Fetched",
      });

      const due = await getFeedsDueForPoll(env.FOCUS_DB);
      expect(due).toHaveLength(1);
      expect(due[0].title).toBe("Never Fetched");
    });

    it("excludes recently fetched feeds", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/recent.xml",
        title: "Recently Fetched",
        fetch_interval_minutes: 60,
      });

      await markFeedFetched(env.FOCUS_DB, feed.id);

      const due = await getFeedsDueForPoll(env.FOCUS_DB);
      expect(due).toHaveLength(0);
    });

    it("includes feeds past their interval", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/overdue.xml",
        title: "Overdue Feed",
        fetch_interval_minutes: 60,
      });

      // Set last_fetched_at to 2 hours ago (past the 60-minute interval)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await env.FOCUS_DB
        .prepare("UPDATE feed SET last_fetched_at = ?1 WHERE id = ?2")
        .bind(twoHoursAgo, feed.id)
        .run();

      const due = await getFeedsDueForPoll(env.FOCUS_DB);
      expect(due).toHaveLength(1);
      expect(due[0].title).toBe("Overdue Feed");
    });

    it("excludes inactive feeds", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/inactive.xml",
        title: "Inactive Feed",
      });

      await updateFeed(env.FOCUS_DB, feed.id, { is_active: 0 });

      const due = await getFeedsDueForPoll(env.FOCUS_DB);
      expect(due).toHaveLength(0);
    });

    it("excludes deleted feeds", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/deleted.xml",
        title: "Deleted Feed",
      });

      await softDeleteFeed(env.FOCUS_DB, feed.id);

      const due = await getFeedsDueForPoll(env.FOCUS_DB);
      expect(due).toHaveLength(0);
    });
  });

  describe("feed tags", () => {
    it("adds, retrieves, and removes tags for feeds", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/tagged.xml",
        title: "Tagged Feed",
      });

      const tag1 = await createTag(env.FOCUS_DB, { name: "tech" });
      const tag2 = await createTag(env.FOCUS_DB, { name: "news" });

      await addTagToFeed(env.FOCUS_DB, feed.id, tag1.id);
      await addTagToFeed(env.FOCUS_DB, feed.id, tag2.id);

      const tags = await getTagsForFeed(env.FOCUS_DB, feed.id);
      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name).sort()).toEqual(["news", "tech"]);

      await removeTagFromFeed(env.FOCUS_DB, feed.id, tag1.id);

      const remaining = await getTagsForFeed(env.FOCUS_DB, feed.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe("news");
    });

    it("deleteTag cascades to feed_tags", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/cascade.xml",
        title: "Cascade Feed",
      });
      const tag = await createTag(env.FOCUS_DB, { name: "will-delete" });
      await addTagToFeed(env.FOCUS_DB, feed.id, tag.id);

      await deleteTag(env.FOCUS_DB, tag.id);

      const tags = await getTagsForFeed(env.FOCUS_DB, feed.id);
      expect(tags).toHaveLength(0);
    });

    it("handles duplicate tag-to-feed gracefully", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/dupe.xml",
        title: "Dupe Feed",
      });
      const tag = await createTag(env.FOCUS_DB, { name: "test" });

      await addTagToFeed(env.FOCUS_DB, feed.id, tag.id);
      await addTagToFeed(env.FOCUS_DB, feed.id, tag.id);

      const tags = await getTagsForFeed(env.FOCUS_DB, feed.id);
      expect(tags).toHaveLength(1);
    });
  });

  describe("listDocuments filters", () => {
    it("filters by feedId", async () => {
      const feed = await createFeed(env.FOCUS_DB, {
        feed_url: "https://example.com/feed.xml",
        title: "Filter Feed",
      });

      await createDocument(env.FOCUS_DB, {
        type: "rss",
        title: "Feed Doc",
        origin_type: "feed",
        source_id: feed.id,
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Manual Doc",
        origin_type: "manual",
      });

      const result = await listDocuments(env.FOCUS_DB, { feedId: feed.id });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Feed Doc");
    });

    it("filters by type", async () => {
      await createDocument(env.FOCUS_DB, {
        type: "rss",
        title: "RSS Doc",
        origin_type: "feed",
      });
      await createDocument(env.FOCUS_DB, {
        type: "email",
        title: "Email Doc",
        origin_type: "subscription",
      });
      await createDocument(env.FOCUS_DB, {
        type: "article",
        title: "Article Doc",
        origin_type: "manual",
      });

      const result = await listDocuments(env.FOCUS_DB, { type: "rss" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("RSS Doc");

      const emailResult = await listDocuments(env.FOCUS_DB, { type: "email" });
      expect(emailResult.items).toHaveLength(1);
      expect(emailResult.items[0].title).toBe("Email Doc");
    });
  });
});
