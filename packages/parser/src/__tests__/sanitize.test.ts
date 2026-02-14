import { describe, it, expect } from "vitest";
import { sanitizeHtml, rewriteCidUrls } from "../sanitize.js";

describe("sanitizeHtml", () => {
  it("strips script tags", () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<script");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("strips event handlers", () => {
    const html = '<img src="photo.jpg" onerror="alert(1)" />';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("onerror");
    expect(result).toContain("photo.jpg");
  });

  it("strips 1x1 tracking pixels", () => {
    const html =
      '<p>Content</p><img src="https://track.example.com/pixel.gif" width="1" height="1" />';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("pixel.gif");
    expect(result).toContain("Content");
  });

  it("strips known tracker domain images", () => {
    const html =
      '<p>Content</p><img src="https://open.substack.com/track/abc" />';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("open.substack.com");
  });

  it("preserves legitimate images", () => {
    const html = '<img src="https://example.com/hero.jpg" alt="Hero" />';
    const result = sanitizeHtml(html);
    expect(result).toContain("hero.jpg");
    expect(result).toContain('alt="Hero"');
  });

  it("preserves basic formatting tags", () => {
    const html =
      "<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em></p>";
    const result = sanitizeHtml(html);
    expect(result).toContain("<h1>");
    expect(result).toContain("<strong>");
    expect(result).toContain("<em>");
  });

  it("strips style tags", () => {
    const html = "<style>body { color: red; }</style><p>Text</p>";
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<style");
    expect(result).toContain("Text");
  });

  it("strips iframes", () => {
    const html = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("iframe");
    expect(result).toContain("Safe");
  });

  it("strips invisible preheader characters from text", () => {
    // Zero-width spaces, soft hyphens, combining grapheme joiners
    const html = "<p>Hello\u200B\u200C\u200D\u034F\u00AD\u2060\uFEFF World</p>";
    const result = sanitizeHtml(html);
    expect(result).toContain("Hello World");
    expect(result).not.toMatch(/[\u200B\u200C\u200D\u034F\u00AD\u2060\uFEFF]/);
  });

  it("removes text nodes that become empty after stripping invisible chars", () => {
    const html = "<p>Content</p>\u200B\u200C\u200D<p>More</p>";
    const result = sanitizeHtml(html);
    expect(result).toContain("Content");
    expect(result).toContain("More");
    expect(result).not.toMatch(/[\u200B\u200C\u200D]/);
  });

  it("unwraps layout tables (no <th>, width=100%)", () => {
    const html =
      '<table width="100%"><tr><td><p>Layout content</p></td></tr></table>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<table");
    expect(result).toContain("Layout content");
  });

  it("unwraps single-column layout tables", () => {
    const html =
      "<table><tr><td>Row 1</td></tr><tr><td>Row 2</td></tr></table>";
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<table");
    expect(result).toContain("Row 1");
    expect(result).toContain("Row 2");
  });

  it("unwraps nested layout tables", () => {
    const html =
      '<table width="100%"><tr><td><table><tr><td>Inner</td></tr></table></td></tr></table>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<table");
    expect(result).toContain("Inner");
  });

  it("preserves data tables (with <th>)", () => {
    const html =
      "<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>";
    const result = sanitizeHtml(html);
    expect(result).toContain("<table");
    expect(result).toContain("<th>");
    expect(result).toContain("Alice");
  });
});

describe("rewriteCidUrls", () => {
  it("rewrites cid: image URLs to proxy paths", () => {
    const html = '<p>Hello</p><img src="cid:img001" />';
    const cidMap = new Map([["img001", "attachments/doc1/img001"]]);
    const result = rewriteCidUrls(html, "doc1", cidMap);
    expect(result).toContain('src="/api/attachments/doc1/img001"');
    expect(result).not.toContain("cid:");
  });

  it("preserves non-cid images", () => {
    const html =
      '<img src="https://example.com/photo.jpg" /><img src="cid:img001" />';
    const cidMap = new Map([["img001", "path"]]);
    const result = rewriteCidUrls(html, "doc1", cidMap);
    expect(result).toContain("https://example.com/photo.jpg");
    expect(result).toContain("/api/attachments/doc1/img001");
  });

  it("leaves unknown cid references unchanged", () => {
    const html = '<img src="cid:unknown" />';
    const cidMap = new Map<string, string>();
    const result = rewriteCidUrls(html, "doc1", cidMap);
    expect(result).toContain("cid:unknown");
  });
});
