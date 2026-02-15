import { describe, it, expect } from "vitest";
import { parseFeedXml, discoverFeedUrl } from "../rss/fetch.js";

const RSS_2_0_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Tech Blog</title>
    <link>https://techblog.example.com</link>
    <description>A blog about technology</description>
    <image>
      <url>https://techblog.example.com/favicon.png</url>
    </image>
    <item>
      <title>First Post</title>
      <link>https://techblog.example.com/first-post</link>
      <guid>post-001</guid>
      <description>A short excerpt of the first post.</description>
      <content:encoded><![CDATA[<p>Full content of the first post with <strong>HTML</strong>.</p>]]></content:encoded>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <dc:creator>Alice</dc:creator>
      <media:content url="https://techblog.example.com/images/post1.jpg" medium="image" />
    </item>
    <item>
      <title>Second Post</title>
      <link>https://techblog.example.com/second-post</link>
      <guid isPermaLink="false">post-002</guid>
      <description>A short excerpt of the second post.</description>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
      <author>bob@example.com (Bob)</author>
      <enclosure url="https://techblog.example.com/images/post2.jpg" type="image/jpeg" length="12345" />
    </item>
    <item>
      <title>Third Post</title>
      <link>https://techblog.example.com/third-post</link>
      <guid>post-003</guid>
      <media:thumbnail url="https://techblog.example.com/images/post3-thumb.jpg" />
    </item>
  </channel>
</rss>`;

const ATOM_1_0_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Science Journal</title>
  <subtitle>Latest discoveries</subtitle>
  <link href="https://science.example.com" rel="alternate" />
  <link href="https://science.example.com/feed.xml" rel="self" />
  <icon>https://science.example.com/icon.png</icon>
  <entry>
    <id>urn:uuid:entry-001</id>
    <title>Discovery One</title>
    <link href="https://science.example.com/discovery-one" rel="alternate" />
    <content type="html"><![CDATA[<p>Full content of discovery one.</p>]]></content>
    <summary>Summary of discovery one.</summary>
    <published>2024-01-15T10:00:00Z</published>
    <author><name>Dr. Smith</name></author>
  </entry>
  <entry>
    <id>urn:uuid:entry-002</id>
    <title>Discovery Two</title>
    <link href="https://science.example.com/discovery-two" rel="alternate" />
    <content type="html"><![CDATA[<p>Full content of discovery two.</p>]]></content>
    <published>2024-01-16T10:00:00Z</published>
    <author><name>Dr. Jones</name></author>
  </entry>
  <entry>
    <id>urn:uuid:entry-003</id>
    <title>Discovery Three</title>
    <link href="https://science.example.com/discovery-three" rel="alternate" />
    <summary>Only a summary for this one.</summary>
    <updated>2024-01-17T10:00:00Z</updated>
  </entry>
</feed>`;

const JSON_FEED_FIXTURE = JSON.stringify({
  version: "https://jsonfeed.org/version/1.1",
  title: "JSON Blog",
  description: "A blog in JSON Feed format",
  home_page_url: "https://jsonblog.example.com",
  favicon: "https://jsonblog.example.com/favicon.ico",
  items: [
    {
      id: "json-001",
      url: "https://jsonblog.example.com/post-1",
      title: "JSON Post One",
      content_html: "<p>HTML content</p>",
      content_text: "Text content",
      summary: "A summary",
      date_published: "2024-02-01T12:00:00Z",
      authors: [{ name: "Charlie" }],
      image: "https://jsonblog.example.com/img1.jpg",
    },
    {
      id: "json-002",
      url: "https://jsonblog.example.com/post-2",
      title: "JSON Post Two",
      content_text: "Only text content",
      date_published: "2024-02-02T12:00:00Z",
    },
  ],
});

const HTML_WITH_RSS_LINK = `<!DOCTYPE html>
<html>
<head>
  <title>My Blog</title>
  <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml" />
</head>
<body><p>Hello</p></body>
</html>`;

const HTML_WITH_ATOM_LINK = `<!DOCTYPE html>
<html>
<head>
  <title>My Blog</title>
  <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="https://example.com/atom.xml" />
</head>
<body><p>Hello</p></body>
</html>`;

const HTML_WITHOUT_FEED = `<!DOCTYPE html>
<html>
<head>
  <title>My Blog</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body><p>Hello</p></body>
</html>`;

describe("parseFeedXml", () => {
  describe("RSS 2.0", () => {
    it("parses feed title, description, siteUrl, and iconUrl", () => {
      const feed = parseFeedXml(RSS_2_0_FIXTURE, "https://techblog.example.com/feed.xml");
      expect(feed.title).toBe("Tech Blog");
      expect(feed.description).toBe("A blog about technology");
      expect(feed.siteUrl).toBe("https://techblog.example.com");
      expect(feed.iconUrl).toBe("https://techblog.example.com/favicon.png");
    });

    it("parses items with all fields", () => {
      const feed = parseFeedXml(RSS_2_0_FIXTURE, "https://techblog.example.com/feed.xml");
      expect(feed.items).toHaveLength(3);

      const first = feed.items[0];
      expect(first.guid).toBe("post-001");
      expect(first.title).toBe("First Post");
      expect(first.url).toBe("https://techblog.example.com/first-post");
      expect(first.contentHtml).toBe("<p>Full content of the first post with <strong>HTML</strong>.</p>");
      expect(first.excerpt).toBe("A short excerpt of the first post.");
      expect(first.publishedAt).toBe("2024-01-01T12:00:00.000Z");
      expect(first.author).toBe("Alice");
      expect(first.coverImageUrl).toBe("https://techblog.example.com/images/post1.jpg");
    });

    it("extracts cover image from enclosure", () => {
      const feed = parseFeedXml(RSS_2_0_FIXTURE, "https://techblog.example.com/feed.xml");
      expect(feed.items[1].coverImageUrl).toBe("https://techblog.example.com/images/post2.jpg");
    });

    it("extracts cover image from media:thumbnail", () => {
      const feed = parseFeedXml(RSS_2_0_FIXTURE, "https://techblog.example.com/feed.xml");
      expect(feed.items[2].coverImageUrl).toBe("https://techblog.example.com/images/post3-thumb.jpg");
    });

    it("handles guid with isPermaLink attribute", () => {
      const feed = parseFeedXml(RSS_2_0_FIXTURE, "https://techblog.example.com/feed.xml");
      expect(feed.items[1].guid).toBe("post-002");
    });
  });

  describe("Atom 1.0", () => {
    it("parses feed title, siteUrl, and iconUrl", () => {
      const feed = parseFeedXml(ATOM_1_0_FIXTURE, "https://science.example.com/feed.xml");
      expect(feed.title).toBe("Science Journal");
      expect(feed.description).toBe("Latest discoveries");
      expect(feed.siteUrl).toBe("https://science.example.com");
      expect(feed.iconUrl).toBe("https://science.example.com/icon.png");
    });

    it("parses items with correct guid, url, content, and dates", () => {
      const feed = parseFeedXml(ATOM_1_0_FIXTURE, "https://science.example.com/feed.xml");
      expect(feed.items).toHaveLength(3);

      const first = feed.items[0];
      expect(first.guid).toBe("urn:uuid:entry-001");
      expect(first.url).toBe("https://science.example.com/discovery-one");
      expect(first.contentHtml).toBe("<p>Full content of discovery one.</p>");
      expect(first.publishedAt).toBe("2024-01-15T10:00:00.000Z");
      expect(first.author).toBe("Dr. Smith");
      expect(first.excerpt).toBe("Summary of discovery one.");
    });

    it("falls back to summary when no content", () => {
      const feed = parseFeedXml(ATOM_1_0_FIXTURE, "https://science.example.com/feed.xml");
      const third = feed.items[2];
      expect(third.contentHtml).toBe("Only a summary for this one.");
    });

    it("falls back to updated date when published is missing", () => {
      const feed = parseFeedXml(ATOM_1_0_FIXTURE, "https://science.example.com/feed.xml");
      const third = feed.items[2];
      expect(third.publishedAt).toBe("2024-01-17T10:00:00.000Z");
    });
  });

  describe("JSON Feed 1.1", () => {
    it("parses feed metadata", () => {
      const feed = parseFeedXml(JSON_FEED_FIXTURE, "https://jsonblog.example.com/feed.json");
      expect(feed.title).toBe("JSON Blog");
      expect(feed.description).toBe("A blog in JSON Feed format");
      expect(feed.siteUrl).toBe("https://jsonblog.example.com");
      expect(feed.iconUrl).toBe("https://jsonblog.example.com/favicon.ico");
    });

    it("parses items with all fields", () => {
      const feed = parseFeedXml(JSON_FEED_FIXTURE, "https://jsonblog.example.com/feed.json");
      expect(feed.items).toHaveLength(2);

      const first = feed.items[0];
      expect(first.guid).toBe("json-001");
      expect(first.title).toBe("JSON Post One");
      expect(first.url).toBe("https://jsonblog.example.com/post-1");
      expect(first.contentHtml).toBe("<p>HTML content</p>");
      expect(first.contentText).toBe("Text content");
      expect(first.excerpt).toBe("A summary");
      expect(first.author).toBe("Charlie");
      expect(first.coverImageUrl).toBe("https://jsonblog.example.com/img1.jpg");
    });
  });

  it("handles missing optional fields gracefully", () => {
    const minimalRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Minimal</title>
    <item>
      <title>No extras</title>
      <link>https://example.com/post</link>
    </item>
  </channel>
</rss>`;

    const feed = parseFeedXml(minimalRss, "https://example.com/feed.xml");
    expect(feed.title).toBe("Minimal");
    expect(feed.description).toBeNull();
    expect(feed.siteUrl).toBeNull();
    expect(feed.iconUrl).toBeNull();
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].author).toBeNull();
    expect(feed.items[0].publishedAt).toBeNull();
    expect(feed.items[0].coverImageUrl).toBeNull();
    expect(feed.items[0].excerpt).toBeNull();
  });

  it("throws on unrecognized format", () => {
    expect(() => parseFeedXml("<html><body>Not a feed</body></html>", "https://example.com")).toThrow("Unrecognized feed format");
  });
});

describe("discoverFeedUrl", () => {
  it("finds RSS link in HTML", () => {
    const result = discoverFeedUrl(HTML_WITH_RSS_LINK, "https://example.com/page");
    expect(result).toBe("https://example.com/feed.xml");
  });

  it("finds Atom link in HTML", () => {
    const result = discoverFeedUrl(HTML_WITH_ATOM_LINK, "https://example.com/page");
    expect(result).toBe("https://example.com/atom.xml");
  });

  it("returns null when no feed link", () => {
    const result = discoverFeedUrl(HTML_WITHOUT_FEED, "https://example.com/page");
    expect(result).toBeNull();
  });

  it("resolves relative URLs", () => {
    const result = discoverFeedUrl(HTML_WITH_RSS_LINK, "https://myblog.com/about");
    expect(result).toBe("https://myblog.com/feed.xml");
  });
});
