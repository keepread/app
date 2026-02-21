import { describe, it, expect } from "vitest";
import { extractMetadata } from "../metadata.js";

const BASE_URL = "https://example.com/article";

function html(head: string, body = ""): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

function htmlWithLang(lang: string, head: string): string {
  return `<!DOCTYPE html><html lang="${lang}"><head>${head}</head><body></body></html>`;
}

describe("extractMetadata", () => {
  // 1. Basic OG tags
  it("extracts basic OG metadata", () => {
    const result = extractMetadata(
      html(`
        <meta property="og:title" content="OG Title">
        <meta property="og:description" content="OG Desc">
        <meta property="og:image" content="https://img.example.com/og.jpg">
        <meta property="og:site_name" content="Example Site">
        <meta property="og:url" content="https://example.com/canonical">
        <meta property="article:published_time" content="2024-06-01T12:00:00Z">
      `),
      BASE_URL
    );

    expect(result.title).toBe("OG Title");
    expect(result.description).toBe("OG Desc");
    expect(result.ogImage).toBe("https://img.example.com/og.jpg");
    expect(result.siteName).toBe("Example Site");
    expect(result.canonicalUrl).toBe("https://example.com/canonical");
    expect(result.publishedDate).toBe("2024-06-01T12:00:00Z");
  });

  // 2. JSON-LD Article
  it("extracts metadata from JSON-LD Article", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        {
          "@type": "Article",
          "headline": "JSON-LD Title",
          "description": "JSON-LD description",
          "author": "Jane Author",
          "datePublished": "2024-05-15T08:00:00Z",
          "image": "https://img.example.com/jsonld.jpg",
          "publisher": { "@type": "Organization", "name": "Publisher Co" }
        }
        </script>
      `),
      BASE_URL
    );

    expect(result.title).toBe("JSON-LD Title");
    expect(result.description).toBe("JSON-LD description");
    expect(result.author).toBe("Jane Author");
    expect(result.publishedDate).toBe("2024-05-15T08:00:00Z");
    expect(result.ogImage).toBe("https://img.example.com/jsonld.jpg");
    expect(result.siteName).toBe("Publisher Co");
  });

  // 3. JSON-LD with @graph
  it("extracts Article from JSON-LD @graph array", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        {
          "@graph": [
            { "@type": "WebSite", "name": "My Blog", "url": "https://blog.example.com" },
            { "@type": "Article", "headline": "Graph Article Title", "author": { "name": "Graph Author" } }
          ]
        }
        </script>
      `),
      BASE_URL
    );

    expect(result.title).toBe("Graph Article Title");
    expect(result.author).toBe("Graph Author");
  });

  // 4. JSON-LD polymorphic author
  it("extracts author from JSON-LD object with name", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        { "@type": "Article", "headline": "Test", "author": { "@type": "Person", "name": "Object Author" } }
        </script>
      `),
      BASE_URL
    );
    expect(result.author).toBe("Object Author");
  });

  it("extracts first author from JSON-LD array", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        { "@type": "Article", "headline": "Test", "author": [{ "name": "First Author" }, { "name": "Second Author" }] }
        </script>
      `),
      BASE_URL
    );
    expect(result.author).toBe("First Author");
  });

  // 5. JSON-LD polymorphic image
  it("extracts image from JSON-LD ImageObject", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        { "@type": "Article", "headline": "Test", "image": { "@type": "ImageObject", "url": "https://img.example.com/object.jpg" } }
        </script>
      `),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://img.example.com/object.jpg");
  });

  it("extracts first image from JSON-LD array", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        { "@type": "Article", "headline": "Test", "image": ["https://img.example.com/first.jpg", "https://img.example.com/second.jpg"] }
        </script>
      `),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://img.example.com/first.jpg");
  });

  // 6. Twitter Cards fallback
  it("falls back to Twitter Card metadata when no OG tags", () => {
    const result = extractMetadata(
      html(`
        <meta name="twitter:title" content="Twitter Title">
        <meta name="twitter:description" content="Twitter Desc">
        <meta name="twitter:image" content="https://img.example.com/twitter.jpg">
        <meta name="twitter:creator" content="@twitteruser">
      `),
      BASE_URL
    );

    expect(result.title).toBe("Twitter Title");
    expect(result.description).toBe("Twitter Desc");
    expect(result.ogImage).toBe("https://img.example.com/twitter.jpg");
    expect(result.author).toBe("@twitteruser");
  });

  // 7. Dublin Core fallback
  it("falls back to Dublin Core metadata", () => {
    const result = extractMetadata(
      html(`
        <meta name="dc.title" content="DC Title">
        <meta name="dc.creator" content="DC Author">
        <meta name="dc.date" content="2024-01-10">
        <meta name="dc.description" content="DC Description">
      `),
      BASE_URL
    );

    expect(result.title).toBe("DC Title");
    expect(result.author).toBe("DC Author");
    expect(result.publishedDate).toBe("2024-01-10");
    expect(result.description).toBe("DC Description");
  });

  // 8. Microdata itemprop fallback
  it("falls back to microdata itemprop attributes", () => {
    const result = extractMetadata(
      html(
        "",
        `
        <span itemprop="author">Itemprop Author</span>
        <meta itemprop="image" content="https://img.example.com/itemprop.jpg">
        <meta itemprop="datePublished" content="2024-02-20">
        <div itemprop="publisher"><span itemprop="name">Itemprop Publisher</span></div>
        `
      ),
      BASE_URL
    );

    expect(result.author).toBe("Itemprop Author");
    expect(result.ogImage).toBe("https://img.example.com/itemprop.jpg");
    expect(result.publishedDate).toBe("2024-02-20");
    expect(result.siteName).toBe("Itemprop Publisher");
  });

  // 9. <time> element date fallback
  it("falls back to <time datetime> for published date", () => {
    const result = extractMetadata(
      html(
        "",
        `<article><time datetime="2024-03-15T10:00:00Z">March 15, 2024</time><p>Content</p></article>`
      ),
      BASE_URL
    );

    expect(result.publishedDate).toBe("2024-03-15T10:00:00Z");
  });

  // 10. Language extraction
  it("extracts language from html lang attribute", () => {
    const result = extractMetadata(
      htmlWithLang("en-US", "<title>Test</title>"),
      BASE_URL
    );
    expect(result.lang).toBe("en");
  });

  it("falls back to og:locale for language", () => {
    const result = extractMetadata(
      html(`<meta property="og:locale" content="fr_FR">`),
      BASE_URL
    );
    expect(result.lang).toBe("fr");
  });

  // 11. Feed autodiscovery
  it("discovers RSS feed URL", () => {
    const result = extractMetadata(
      html(`<link rel="alternate" type="application/rss+xml" href="/feed.xml">`),
      BASE_URL
    );
    expect(result.feedUrl).toBe("https://example.com/feed.xml");
  });

  it("discovers Atom feed URL", () => {
    const result = extractMetadata(
      html(`<link rel="alternate" type="application/atom+xml" href="/atom.xml">`),
      BASE_URL
    );
    expect(result.feedUrl).toBe("https://example.com/atom.xml");
  });

  // 12. Relative URL resolution
  it("resolves relative URLs for canonical, image, and favicon", () => {
    const result = extractMetadata(
      html(`
        <link rel="canonical" href="/canonical-page">
        <meta property="og:image" content="/images/hero.jpg">
        <link rel="icon" href="/favicon.ico">
      `),
      BASE_URL
    );

    expect(result.canonicalUrl).toBe("https://example.com/canonical-page");
    expect(result.ogImage).toBe("https://example.com/images/hero.jpg");
    expect(result.favicon).toBe("https://example.com/favicon.ico");
  });

  // 13. Canonical URL tracking param cleanup
  it("strips tracking parameters from canonical URL", () => {
    const result = extractMetadata(
      html(`<link rel="canonical" href="https://example.com/article?utm_source=twitter&utm_medium=social&id=123">`),
      BASE_URL
    );

    expect(result.canonicalUrl).toBe("https://example.com/article?id=123");
  });

  // 14. Malformed JSON-LD
  it("handles malformed JSON-LD gracefully", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">{ broken json [</script>
        <meta property="og:title" content="Fallback Title">
      `),
      BASE_URL
    );

    expect(result.title).toBe("Fallback Title");
  });

  // 15. OG image variants
  it("extracts og:image:secure_url", () => {
    const result = extractMetadata(
      html(`<meta property="og:image:secure_url" content="https://secure.example.com/image.jpg">`),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://secure.example.com/image.jpg");
  });

  it("extracts og:image:url", () => {
    const result = extractMetadata(
      html(`<meta property="og:image:url" content="https://example.com/image-url.jpg">`),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://example.com/image-url.jpg");
  });

  // 16. Priority ordering — JSON-LD wins over OG and Twitter
  it("prioritizes JSON-LD over OG and Twitter for title", () => {
    const result = extractMetadata(
      html(`
        <script type="application/ld+json">
        { "@type": "Article", "headline": "JSON-LD Wins", "description": "JSON-LD Desc", "author": "JSON-LD Author" }
        </script>
        <meta property="og:title" content="OG Title">
        <meta property="og:description" content="OG Desc">
        <meta name="twitter:title" content="Twitter Title">
        <meta name="author" content="Meta Author">
      `),
      BASE_URL
    );

    expect(result.title).toBe("JSON-LD Wins");
    expect(result.description).toBe("JSON-LD Desc");
    // author: JSON-LD author wins over meta[name=author]
    expect(result.author).toBe("JSON-LD Author");
  });

  // 17. No metadata at all — siteName falls back to domain, favicon to /favicon.ico
  it("returns defaults for bare HTML", () => {
    const result = extractMetadata(
      "<!DOCTYPE html><html><body>Hello</body></html>",
      BASE_URL
    );

    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(result.author).toBeNull();
    expect(result.siteName).toBe("example.com");
    expect(result.ogImage).toBeNull();
    expect(result.favicon).toBe("https://example.com/favicon.ico");
    expect(result.canonicalUrl).toBeNull();
    expect(result.publishedDate).toBeNull();
    expect(result.lang).toBeNull();
    expect(result.feedUrl).toBeNull();
  });

  it("falls back to domain for siteName when no meta tags", () => {
    const result = extractMetadata(
      "<!DOCTYPE html><html><body>Hello</body></html>",
      "https://www.blog.example.com/post/1"
    );
    expect(result.siteName).toBe("blog.example.com");
  });

  it("falls back to /favicon.ico when no link tag present", () => {
    const result = extractMetadata(
      "<!DOCTYPE html><html><body>Hello</body></html>",
      "https://www.example.com/article"
    );
    expect(result.favicon).toBe("https://www.example.com/favicon.ico");
  });

  // Additional edge cases

  it("extracts itemprop image from src attribute", () => {
    const result = extractMetadata(
      html("", `<img itemprop="image" src="https://img.example.com/src.jpg">`),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://img.example.com/src.jpg");
  });

  it("extracts datePublished from itemprop datetime attribute", () => {
    const result = extractMetadata(
      html("", `<time itemprop="datePublished" datetime="2024-07-04T00:00:00Z">July 4</time>`),
      BASE_URL
    );
    expect(result.publishedDate).toBe("2024-07-04T00:00:00Z");
  });

  it("extracts dcterms.date as date fallback", () => {
    const result = extractMetadata(
      html(`<meta name="dcterms.date" content="2024-11-01">`),
      BASE_URL
    );
    expect(result.publishedDate).toBe("2024-11-01");
  });

  it("extracts twitter:image:src variant", () => {
    const result = extractMetadata(
      html(`<meta name="twitter:image:src" content="https://img.example.com/twitter-src.jpg">`),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://img.example.com/twitter-src.jpg");
  });

  it("extracts application-name as siteName fallback", () => {
    const result = extractMetadata(
      html(`<meta name="application-name" content="My App">`),
      BASE_URL
    );
    expect(result.siteName).toBe("My App");
  });

  it("extracts content-language meta for lang", () => {
    const result = extractMetadata(
      html(`<meta http-equiv="content-language" content="de">`),
      BASE_URL
    );
    expect(result.lang).toBe("de");
  });

  it("extracts rel=author text as author fallback", () => {
    const result = extractMetadata(
      html("", `<a rel="author">Rel Author</a>`),
      BASE_URL
    );
    expect(result.author).toBe("Rel Author");
  });

  it("falls back to <title> element for title", () => {
    const result = extractMetadata(
      html(`<title>  Page Title  </title>`),
      BASE_URL
    );
    expect(result.title).toBe("Page Title");
  });

  // Hero image heuristic tests

  it("finds hero image from article img when no meta image exists", () => {
    const result = extractMetadata(
      html("", `<article><img src="/images/hero.jpg" width="800" height="400"></article>`),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://example.com/images/hero.jpg");
  });

  it("prefers lazy-load data-src over src for hero image", () => {
    const result = extractMetadata(
      html("", `<main><img data-src="/images/lazy-hero.jpg" src="/placeholder.gif" width="600"></main>`),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://example.com/images/lazy-hero.jpg");
  });

  it("skips tracking pixels and avatar images in hero image scan", () => {
    const result = extractMetadata(
      html("", `
        <article>
          <img src="/pixel.gif" width="1" height="1">
          <img src="/avatar.jpg" class="author-avatar" width="48">
          <img src="/real-hero.jpg" width="800">
        </article>
      `),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://example.com/real-hero.jpg");
  });

  it("skips data URI images in hero image scan", () => {
    const result = extractMetadata(
      html("", `
        <article>
          <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="800">
          <img src="/actual-image.jpg" width="600">
        </article>
      `),
      BASE_URL
    );
    expect(result.ogImage).toBe("https://example.com/actual-image.jpg");
  });
});
