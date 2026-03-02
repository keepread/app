import { describe, it, expect } from "vitest";
import { extractArticle } from "../article.js";

const SIMPLE_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
  <article>
    <h1>Test Article</h1>
    <p class="byline">By John Doe</p>
    <p>This is the first paragraph of the article. It contains enough text to be recognized by Readability as meaningful content that should be extracted.</p>
    <p>This is the second paragraph with more content. We need a decent amount of text for Readability to consider this a valid article body worth extracting.</p>
    <p>Here is a third paragraph to ensure the content meets the minimum threshold. The article discusses important topics that readers will find valuable and informative.</p>
    <p>A fourth paragraph adds even more substance. Good articles typically have multiple paragraphs covering different aspects of the topic at hand.</p>
    <p>Finally, a fifth paragraph wraps things up. This should be more than enough content for the extraction algorithm to work with.</p>
  </article>
</body>
</html>
`;

describe("extractArticle", () => {
  it("extracts title and content from a simple HTML page", () => {
    const result = extractArticle(SIMPLE_ARTICLE_HTML, "https://example.com/article");

    expect(result.title).toBeTruthy();
    expect(result.htmlContent).toContain("first paragraph");
    expect(result.markdownContent).toContain("first paragraph");
    expect(result.excerpt).toBeTruthy();
  });

  it("returns sanitized HTML content", () => {
    const htmlWithScript = `
      <!DOCTYPE html>
      <html>
      <head><title>Unsafe Page</title></head>
      <body>
        <article>
          <h1>Article Title</h1>
          <p>Safe content here. This paragraph has enough text to be extracted by the readability algorithm.</p>
          <script>alert("xss")</script>
          <p>More safe content. We add several paragraphs so Readability will process this article properly.</p>
          <p>Third paragraph of additional content for the readability parser to work with here.</p>
          <p>Fourth paragraph ensuring extraction meets the character threshold requirement.</p>
          <p>Fifth paragraph with final thoughts on the topic being discussed in this article.</p>
        </article>
      </body>
      </html>
    `;
    const result = extractArticle(htmlWithScript, "https://example.com/unsafe");

    expect(result.htmlContent).not.toContain("<script");
    expect(result.htmlContent).toContain("Safe content");
  });

  it("falls back when Readability cannot extract content", () => {
    const minimalHtml = "<p>Just a tiny snippet.</p>";
    const result = extractArticle(minimalHtml, "https://example.com/minimal");

    // Should still return something usable
    expect(result.htmlContent).toBeTruthy();
    expect(result.markdownContent).toBeTruthy();
  });

  it("calculates word count and reading time", () => {
    const result = extractArticle(SIMPLE_ARTICLE_HTML, "https://example.com/article");

    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it("converts content to markdown", () => {
    const result = extractArticle(SIMPLE_ARTICLE_HTML, "https://example.com/article");

    // Markdown should not contain HTML tags for simple text
    expect(result.markdownContent).not.toContain("<p>");
    expect(result.markdownContent).toContain("first paragraph");
  });

  it("prepends hero image when it is in a sibling div outside the article prose", () => {
    // Mirrors the common Nuxt/Next.js/Ghost pattern where the hero image lives
    // in its own wrapper div adjacent to—but not inside—the prose container.
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Article with Hero</title></head>
      <body>
        <nav><img src="/logo.svg" alt="Site Logo"></nav>
        <div class="author-section">
          <img src="/author/burak.jpeg" alt="Burak" width="40" height="40">
          <span>Burak Karakan · Co-founder</span>
        </div>
        <div class="hero-wrapper">
          <img src="/blog/go-agents/cover.jpeg" alt="" class="aspect-video w-full object-cover">
        </div>
        <div class="prose">
          <p>Article body first paragraph. It has enough text for Readability to extract it as the main article content worth processing.</p>
          <p>Second paragraph adds more substance. This content discusses Go as a programming language for building AI agents and distributed systems.</p>
          <p>Third paragraph continues the discussion with technical details about concurrency, goroutines, and performance characteristics of Go.</p>
          <p>Fourth paragraph explores the ecosystem around Go including its standard library, tooling, and community support for modern development.</p>
          <p>Fifth paragraph wraps up the argument for Go as the best language for agent-based systems and distributed computing workloads.</p>
        </div>
      </body>
      </html>
    `;
    const result = extractArticle(html, "https://example.com/blog/go-agents");

    expect(result.htmlContent).toContain("cover.jpeg");
    expect(result.htmlContent).toContain("Article body first paragraph");
    // Hero image should appear before the article text
    const heroIdx = result.htmlContent.indexOf("cover.jpeg");
    const textIdx = result.htmlContent.indexOf("Article body first paragraph");
    expect(heroIdx).toBeLessThan(textIdx);
  });

  it("does not prepend hero when article already starts with an image", () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Article with Inline Hero</title></head>
      <body>
        <div class="hero-wrapper">
          <img src="/blog/outside-cover.jpeg" alt="">
        </div>
        <article>
          <img src="/blog/inline-hero.jpeg" alt="Hero" class="w-full">
          <p>Article body first paragraph. It has enough text for Readability to extract it as the main article content worth processing.</p>
          <p>Second paragraph adds more substance about the topic being discussed in this piece of content.</p>
          <p>Third paragraph provides additional context and supporting evidence for the main argument being made.</p>
          <p>Fourth paragraph explores related concepts and offers deeper analysis of the subject matter.</p>
          <p>Fifth paragraph concludes the article with a summary and key takeaways for the reader.</p>
        </article>
      </body>
      </html>
    `;
    const result = extractArticle(html, "https://example.com/blog/inline");

    expect(result.htmlContent).toContain("inline-hero.jpeg");
    expect(result.htmlContent).not.toContain("outside-cover.jpeg");
  });

  it("filters out logos and tiny images when looking for the hero", () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Article with Logo Before Content</title></head>
      <body>
        <header>
          <img src="/brand-logo.svg" alt="Brand Logo">
          <img src="/small-icon.png" width="16" height="16" alt="">
        </header>
        <div class="hero-wrapper">
          <img src="/blog/real-hero.jpeg" alt="" class="w-full">
        </div>
        <div class="prose">
          <p>Article body first paragraph. It has enough text for Readability to extract it as the main article content worth processing.</p>
          <p>Second paragraph adds more substance about the topic being discussed in this piece of content here.</p>
          <p>Third paragraph provides additional context and supporting evidence for the main argument made.</p>
          <p>Fourth paragraph explores related concepts and offers deeper analysis of the subject matter.</p>
          <p>Fifth paragraph concludes the article with a summary and key takeaways for the reader.</p>
        </div>
      </body>
      </html>
    `;
    const result = extractArticle(html, "https://example.com/blog/logos");

    expect(result.htmlContent).toContain("real-hero.jpeg");
    expect(result.htmlContent).not.toContain("brand-logo.svg");
    expect(result.htmlContent).not.toContain("small-icon.png");
  });

  it("extracts site name when available", () => {
    const htmlWithMeta = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Article - My Blog</title>
        <meta property="og:site_name" content="My Blog" />
      </head>
      <body>
        <article>
          <h1>Great Article</h1>
          <p>This article has a site name in its metadata. We need enough content for readability.</p>
          <p>Second paragraph with more details about the topic being discussed here today.</p>
          <p>Third paragraph to pad the content length so Readability will extract it properly.</p>
          <p>Fourth paragraph with additional context and information about the subject matter.</p>
          <p>Fifth paragraph wrapping up the article with some final concluding thoughts.</p>
        </article>
      </body>
      </html>
    `;
    const result = extractArticle(htmlWithMeta, "https://myblog.com/article");

    expect(result.siteName).toBe("My Blog");
  });
});
