import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@focus-reader/db", () => ({
  listFeeds: vi.fn(),
  createFeed: vi.fn(),
  getFeedByUrl: vi.fn(),
  updateFeed: vi.fn(),
  softDeleteFeed: vi.fn(),
  hardDeleteFeed: vi.fn(),
  addTagToFeed: vi.fn(),
  removeTagFromFeed: vi.fn(),
}));

vi.mock("@focus-reader/parser", () => ({
  fetchFeed: vi.fn(),
  discoverFeedUrl: vi.fn(),
  parseOpml: vi.fn(),
  generateOpml: vi.fn(),
}));

// Must import after vi.mock
const {
  listFeeds,
  createFeed,
  getFeedByUrl,
  updateFeed,
  softDeleteFeed,
  hardDeleteFeed,
  addTagToFeed,
  removeTagFromFeed,
} = await import("@focus-reader/db");
const { fetchFeed, discoverFeedUrl, parseOpml, generateOpml } = await import(
  "@focus-reader/parser"
);

const {
  addFeed,
  patchFeed,
  removeFeed,
  tagFeed,
  untagFeed,
  importOpml,
  exportOpml,
  DuplicateFeedError,
} = await import("../feeds.js");

const mockDb = {} as D1Database;

beforeEach(() => {
  vi.resetAllMocks();
  // Suppress global fetch by default
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("fetch not mocked"))
  );
});

describe("addFeed", () => {
  it("adds a feed when URL is a direct feed URL", async () => {
    const parsedFeed = {
      title: "My Blog",
      description: "A great blog",
      siteUrl: "https://myblog.com",
      iconUrl: "https://myblog.com/icon.png",
      items: [],
    };
    vi.mocked(fetchFeed).mockResolvedValue(parsedFeed);
    vi.mocked(getFeedByUrl).mockResolvedValue(null);
    vi.mocked(createFeed).mockResolvedValue({
      id: "feed-1",
      feed_url: "https://myblog.com/feed.xml",
      title: "My Blog",
      description: "A great blog",
      site_url: "https://myblog.com",
      icon_url: "https://myblog.com/icon.png",
      last_fetched_at: null,
      fetch_interval_minutes: 60,
      is_active: 1,
      fetch_full_content: 0,
      auto_tag_rules: null,
      error_count: 0,
      last_error: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });

    const result = await addFeed(mockDb, "https://myblog.com/feed.xml");

    // Duplicate check happens BEFORE fetchFeed for direct URLs
    expect(getFeedByUrl).toHaveBeenCalledWith(
      mockDb,
      "https://myblog.com/feed.xml"
    );
    expect(fetchFeed).toHaveBeenCalledWith("https://myblog.com/feed.xml");
    expect(createFeed).toHaveBeenCalledWith(mockDb, {
      feed_url: "https://myblog.com/feed.xml",
      title: "My Blog",
      description: "A great blog",
      site_url: "https://myblog.com",
      icon_url: "https://myblog.com/icon.png",
    });
    expect(result.id).toBe("feed-1");
  });

  it("discovers feed URL from HTML when direct fetch fails", async () => {
    vi.mocked(fetchFeed)
      .mockRejectedValueOnce(new Error("Not a feed"))
      .mockResolvedValueOnce({
        title: "Discovered Blog",
        description: null,
        siteUrl: "https://myblog.com",
        iconUrl: null,
        items: [],
      });

    const mockHtml =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>';
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })
    );

    vi.mocked(discoverFeedUrl).mockReturnValue(
      "https://myblog.com/feed.xml"
    );
    vi.mocked(getFeedByUrl).mockResolvedValue(null);
    vi.mocked(createFeed).mockResolvedValue({
      id: "feed-2",
      feed_url: "https://myblog.com/feed.xml",
      title: "Discovered Blog",
      description: null,
      site_url: "https://myblog.com",
      icon_url: null,
      last_fetched_at: null,
      fetch_interval_minutes: 60,
      is_active: 1,
      fetch_full_content: 0,
      auto_tag_rules: null,
      error_count: 0,
      last_error: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });

    const result = await addFeed(mockDb, "https://myblog.com");

    expect(discoverFeedUrl).toHaveBeenCalledWith(mockHtml, "https://myblog.com");
    expect(fetchFeed).toHaveBeenCalledTimes(2);
    expect(fetchFeed).toHaveBeenLastCalledWith("https://myblog.com/feed.xml");
    expect(result.id).toBe("feed-2");
  });

  it("throws DuplicateFeedError before network fetch when URL already in DB", async () => {
    vi.mocked(getFeedByUrl).mockResolvedValue({
      id: "existing-feed",
      feed_url: "https://myblog.com/feed.xml",
      title: "Existing Blog",
      description: null,
      site_url: null,
      icon_url: null,
      last_fetched_at: null,
      fetch_interval_minutes: 60,
      is_active: 1,
      fetch_full_content: 0,
      auto_tag_rules: null,
      error_count: 0,
      last_error: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });

    await expect(
      addFeed(mockDb, "https://myblog.com/feed.xml")
    ).rejects.toThrow(DuplicateFeedError);

    // fetchFeed should NOT have been called — duplicate detected before network
    expect(fetchFeed).not.toHaveBeenCalled();

    try {
      await addFeed(mockDb, "https://myblog.com/feed.xml");
    } catch (err) {
      expect(err).toBeInstanceOf(DuplicateFeedError);
      expect((err as InstanceType<typeof DuplicateFeedError>).existingId).toBe("existing-feed");
    }
  });
});

describe("importOpml", () => {
  it("imports new feeds and skips existing ones", async () => {
    const opmlFeeds = [
      { title: "Blog A", feedUrl: "https://a.com/feed.xml", siteUrl: null },
      {
        title: "Blog B",
        feedUrl: "https://b.com/feed.xml",
        siteUrl: "https://b.com",
      },
      { title: "Blog C", feedUrl: "https://c.com/feed.xml", siteUrl: null },
    ];
    vi.mocked(parseOpml).mockReturnValue(opmlFeeds);

    // Blog B already exists
    vi.mocked(getFeedByUrl)
      .mockResolvedValueOnce(null) // Blog A: new
      .mockResolvedValueOnce({
        // Blog B: existing
        id: "existing-b",
        feed_url: "https://b.com/feed.xml",
        title: "Blog B",
        description: null,
        site_url: "https://b.com",
        icon_url: null,
        last_fetched_at: null,
        fetch_interval_minutes: 60,
        is_active: 1,
        fetch_full_content: 0,
        auto_tag_rules: null,
        error_count: 0,
        last_error: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
      })
      .mockResolvedValueOnce(null); // Blog C: new

    vi.mocked(createFeed).mockResolvedValue({
      id: "new-feed",
      feed_url: "",
      title: "",
      description: null,
      site_url: null,
      icon_url: null,
      last_fetched_at: null,
      fetch_interval_minutes: 60,
      is_active: 1,
      fetch_full_content: 0,
      auto_tag_rules: null,
      error_count: 0,
      last_error: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });

    const result = await importOpml(mockDb, "<opml>...</opml>");

    expect(result).toEqual({ imported: 2, skipped: 1 });
    expect(createFeed).toHaveBeenCalledTimes(2);
    expect(createFeed).toHaveBeenCalledWith(mockDb, {
      feed_url: "https://a.com/feed.xml",
      title: "Blog A",
      site_url: null,
    });
    expect(createFeed).toHaveBeenCalledWith(mockDb, {
      feed_url: "https://c.com/feed.xml",
      title: "Blog C",
      site_url: null,
    });
  });
});

describe("exportOpml", () => {
  it("generates OPML from all feeds", async () => {
    const feeds = [
      {
        id: "f1",
        feed_url: "https://a.com/feed.xml",
        title: "Blog A",
        site_url: "https://a.com",
        description: null,
        icon_url: null,
        last_fetched_at: null,
        fetch_interval_minutes: 60,
        is_active: 1,
        fetch_full_content: 0,
        auto_tag_rules: null,
        error_count: 0,
        last_error: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
        documentCount: 10,
        unreadCount: 3,
      },
      {
        id: "f2",
        feed_url: "https://b.com/feed.xml",
        title: "Blog B",
        site_url: null,
        description: null,
        icon_url: null,
        last_fetched_at: null,
        fetch_interval_minutes: 60,
        is_active: 1,
        fetch_full_content: 0,
        auto_tag_rules: null,
        error_count: 0,
        last_error: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
        documentCount: 5,
        unreadCount: 1,
      },
    ];
    vi.mocked(listFeeds).mockResolvedValue(feeds);
    vi.mocked(generateOpml).mockReturnValue("<opml>generated</opml>");

    const result = await exportOpml(mockDb);

    expect(generateOpml).toHaveBeenCalledWith(
      [
        {
          title: "Blog A",
          feedUrl: "https://a.com/feed.xml",
          siteUrl: "https://a.com",
        },
        {
          title: "Blog B",
          feedUrl: "https://b.com/feed.xml",
          siteUrl: null,
        },
      ],
      "Focus Reader Feeds"
    );
    expect(result).toBe("<opml>generated</opml>");
  });
});

describe("patchFeed", () => {
  it("delegates to updateFeed", async () => {
    vi.mocked(updateFeed).mockResolvedValue(undefined);

    await patchFeed(mockDb, "feed-1", { title: "New Title" });

    expect(updateFeed).toHaveBeenCalledWith(mockDb, "feed-1", {
      title: "New Title",
    });
  });
});

describe("removeFeed", () => {
  it("soft-deletes by default", async () => {
    vi.mocked(softDeleteFeed).mockResolvedValue(undefined);

    await removeFeed(mockDb, "feed-1");

    expect(softDeleteFeed).toHaveBeenCalledWith(mockDb, "feed-1");
    expect(hardDeleteFeed).not.toHaveBeenCalled();
  });

  it("hard-deletes when hard=true", async () => {
    vi.mocked(hardDeleteFeed).mockResolvedValue(undefined);

    await removeFeed(mockDb, "feed-1", true);

    expect(hardDeleteFeed).toHaveBeenCalledWith(mockDb, "feed-1");
    expect(softDeleteFeed).not.toHaveBeenCalled();
  });
});

describe("tagFeed / untagFeed", () => {
  it("tagFeed delegates to addTagToFeed", async () => {
    vi.mocked(addTagToFeed).mockResolvedValue(undefined);

    await tagFeed(mockDb, "feed-1", "tag-1");

    expect(addTagToFeed).toHaveBeenCalledWith(mockDb, "feed-1", "tag-1");
  });

  it("untagFeed delegates to removeTagFromFeed", async () => {
    vi.mocked(removeTagFromFeed).mockResolvedValue(undefined);

    await untagFeed(mockDb, "feed-1", "tag-1");

    expect(removeTagFromFeed).toHaveBeenCalledWith(mockDb, "feed-1", "tag-1");
  });
});
