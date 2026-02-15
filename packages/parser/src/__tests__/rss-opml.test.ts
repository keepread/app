import { describe, it, expect } from "vitest";
import { parseOpml, generateOpml, type OpmlFeed } from "../rss/opml.js";

const FLAT_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Feeds</title></head>
  <body>
    <outline text="Tech Blog" title="Tech Blog" type="rss" xmlUrl="https://techblog.example.com/feed.xml" htmlUrl="https://techblog.example.com" />
    <outline text="Science Daily" title="Science Daily" type="rss" xmlUrl="https://science.example.com/rss" htmlUrl="https://science.example.com" />
    <outline text="News Feed" title="News Feed" type="rss" xmlUrl="https://news.example.com/feed" />
  </body>
</opml>`;

const NESTED_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Categorized Feeds</title></head>
  <body>
    <outline text="Technology">
      <outline text="Ars Technica" title="Ars Technica" type="rss" xmlUrl="https://arstechnica.com/feed/" htmlUrl="https://arstechnica.com" />
      <outline text="Hacker News" title="Hacker News" type="rss" xmlUrl="https://news.ycombinator.com/rss" htmlUrl="https://news.ycombinator.com" />
    </outline>
    <outline text="Science">
      <outline text="Nature" title="Nature" type="rss" xmlUrl="https://nature.com/feed" htmlUrl="https://nature.com" />
    </outline>
    <outline text="Standalone Feed" title="Standalone Feed" type="rss" xmlUrl="https://standalone.example.com/feed.xml" />
  </body>
</opml>`;

const MINIMAL_OPML = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Minimal</title></head>
  <body>
    <outline xmlUrl="https://example.com/feed" />
    <outline text="Has title" xmlUrl="https://other.example.com/feed" />
  </body>
</opml>`;

describe("parseOpml", () => {
  it("extracts feeds from flat outline", () => {
    const feeds = parseOpml(FLAT_OPML);
    expect(feeds).toHaveLength(3);
    expect(feeds[0]).toEqual({
      title: "Tech Blog",
      feedUrl: "https://techblog.example.com/feed.xml",
      siteUrl: "https://techblog.example.com",
    });
    expect(feeds[1]).toEqual({
      title: "Science Daily",
      feedUrl: "https://science.example.com/rss",
      siteUrl: "https://science.example.com",
    });
    expect(feeds[2]).toEqual({
      title: "News Feed",
      feedUrl: "https://news.example.com/feed",
      siteUrl: null,
    });
  });

  it("extracts feeds from nested/categorized outline", () => {
    const feeds = parseOpml(NESTED_OPML);
    expect(feeds).toHaveLength(4);
    expect(feeds.map((f) => f.title)).toEqual([
      "Ars Technica",
      "Hacker News",
      "Nature",
      "Standalone Feed",
    ]);
    expect(feeds[0].feedUrl).toBe("https://arstechnica.com/feed/");
    expect(feeds[0].siteUrl).toBe("https://arstechnica.com");
  });

  it("handles missing optional fields", () => {
    const feeds = parseOpml(MINIMAL_OPML);
    expect(feeds).toHaveLength(2);
    expect(feeds[0].title).toBe("");
    expect(feeds[0].siteUrl).toBeNull();
    expect(feeds[1].title).toBe("Has title");
  });
});

describe("generateOpml", () => {
  it("generates valid OPML XML", () => {
    const feeds: OpmlFeed[] = [
      { title: "Blog A", feedUrl: "https://a.com/feed", siteUrl: "https://a.com" },
      { title: "Blog B", feedUrl: "https://b.com/feed", siteUrl: null },
    ];

    const xml = generateOpml(feeds, "My Export");
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain("<title>My Export</title>");
    expect(xml).toContain('xmlUrl="https://a.com/feed"');
    expect(xml).toContain('htmlUrl="https://a.com"');
    expect(xml).toContain('xmlUrl="https://b.com/feed"');
    expect(xml).not.toContain("htmlUrl=\"\"");
  });

  it("escapes special XML characters", () => {
    const feeds: OpmlFeed[] = [
      { title: "Blog & <Friends>", feedUrl: "https://a.com/feed?a=1&b=2", siteUrl: null },
    ];
    const xml = generateOpml(feeds);
    expect(xml).toContain("Blog &amp; &lt;Friends&gt;");
    expect(xml).toContain("https://a.com/feed?a=1&amp;b=2");
  });
});

describe("roundtrip", () => {
  it("parseOpml(generateOpml(feeds)) preserves all feed URLs and titles", () => {
    const original: OpmlFeed[] = [
      { title: "Feed One", feedUrl: "https://one.example.com/feed.xml", siteUrl: "https://one.example.com" },
      { title: "Feed Two", feedUrl: "https://two.example.com/rss", siteUrl: "https://two.example.com" },
      { title: "Feed Three", feedUrl: "https://three.example.com/atom.xml", siteUrl: null },
    ];

    const xml = generateOpml(original, "Roundtrip Test");
    const parsed = parseOpml(xml);

    expect(parsed).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(parsed[i].title).toBe(original[i].title);
      expect(parsed[i].feedUrl).toBe(original[i].feedUrl);
      expect(parsed[i].siteUrl).toBe(original[i].siteUrl);
    }
  });
});
