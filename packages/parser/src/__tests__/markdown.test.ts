import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { htmlToMarkdown } from "../markdown.js";
import { sanitizeHtml } from "../sanitize.js";
import { parseEmail } from "../email/parse.js";

function loadFixture(name: string): ArrayBuffer {
  const path = resolve(__dirname, "../../fixtures", name);
  const buffer = readFileSync(path);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

describe("htmlToMarkdown", () => {
  it("converts headings", () => {
    const result = htmlToMarkdown("<h1>Title</h1><h2>Subtitle</h2>");
    expect(result).toContain("# Title");
    expect(result).toContain("## Subtitle");
  });

  it("converts paragraphs and bold/italic", () => {
    const result = htmlToMarkdown(
      "<p><strong>Bold</strong> and <em>italic</em></p>"
    );
    expect(result).toContain("**Bold**");
    expect(result).toContain("_italic_");
  });

  it("converts links", () => {
    const result = htmlToMarkdown(
      '<a href="https://example.com">Click here</a>'
    );
    expect(result).toContain("[Click here](https://example.com)");
  });

  it("converts unordered lists", () => {
    const result = htmlToMarkdown(
      "<ul><li>Item 1</li><li>Item 2</li></ul>"
    );
    expect(result).toContain("Item 1");
    expect(result).toContain("Item 2");
    expect(result).toContain("-");
  });

  it("converts ordered lists", () => {
    const result = htmlToMarkdown(
      "<ol><li>First</li><li>Second</li></ol>"
    );
    expect(result).toContain("1.  First");
    expect(result).toContain("2.  Second");
  });

  it("converts code blocks", () => {
    const result = htmlToMarkdown(
      "<pre><code>const x = 1;</code></pre>"
    );
    expect(result).toContain("```");
    expect(result).toContain("const x = 1;");
  });

  it("produces clean markdown from layout-table-heavy email HTML", () => {
    const emailHtml = `
      <table width="100%"><tr><td>
        <table width="600"><tr><td>
          <h1>Newsletter Title</h1>
          <p>This is the <strong>main content</strong> of the newsletter.</p>
          <table width="100%"><tr><td>
            <a href="https://example.com">Read more</a>
          </td></tr></table>
        </td></tr></table>
      </td></tr></table>
    `;
    const sanitized = sanitizeHtml(emailHtml);
    const markdown = htmlToMarkdown(sanitized);
    expect(markdown).toContain("# Newsletter Title");
    expect(markdown).toContain("**main content**");
    expect(markdown).toContain("[Read more](https://example.com)");
    expect(markdown).not.toContain("<table");
    expect(markdown).not.toContain("<td");
  });
});

describe("real Substack email integration", () => {
  it("produces clean markdown from a real Substack newsletter", async () => {
    const raw = loadFixture("substack-newsletter.eml");
    const parsed = await parseEmail(raw);

    expect(parsed.subject).toBe("AMA (Ask Machines Anything)");
    expect(parsed.html).toBeTruthy();

    const sanitized = sanitizeHtml(parsed.html!);
    const markdown = htmlToMarkdown(sanitized);

    // Layout tables should be unwrapped — no raw HTML table tags in output
    expect(markdown).not.toContain("<table");
    expect(markdown).not.toContain("<td");
    expect(markdown).not.toContain("<tr");

    // Preheader invisible characters should be stripped
    // &#847; = U+034F (combining grapheme joiner), &#173; = U+00AD (soft hyphen)
    expect(markdown).not.toMatch(/\u034F/);
    expect(markdown).not.toMatch(/\u00AD/);
    expect(markdown).not.toMatch(/\u200B/);

    // Actual newsletter content should survive
    expect(markdown).toContain("AMA (Ask Machines Anything)");
    expect(markdown).toContain("AI");
  });
});
