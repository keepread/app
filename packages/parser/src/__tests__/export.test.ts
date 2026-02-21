import { describe, it, expect } from "vitest";
import {
  generateFrontmatter,
  formatDocumentAsMarkdown,
  formatHighlightsAsMarkdown,
} from "../export.js";
import type { Document, Tag, HighlightWithTags, HighlightWithDocument } from "@focus-reader/shared";

const mockDoc: Document = {
  id: "d1",
  user_id: "test-user-id",
  type: "article",
  title: "Test Article",
  author: "Jane Doe",
  url: "https://example.com/test",
  author_url: null,
  site_name: null,
  excerpt: null,
  word_count: 500,
  reading_time_minutes: 3,
  cover_image_url: null,
  cover_image_r2_key: null,
  favicon_url: null,
  html_content: null,
  markdown_content: null,
  plain_text_content: null,
  reading_progress: 75,
  location: "inbox",
  is_read: 0,
  is_starred: 0,
  last_read_at: null,
  origin_type: "manual",
  saved_at: "2026-02-15T10:00:00.000Z",
  published_at: "2026-02-10T08:00:00.000Z",
  lang: null,
  updated_at: "2026-02-15T10:00:00.000Z",
  deleted_at: null,
  source_id: null,
};

const mockTags: Tag[] = [
  { id: "t1", user_id: "test-user-id", name: "reading", color: "#6366f1", description: null, created_at: "2026-01-01T00:00:00Z" },
  { id: "t2", user_id: "test-user-id", name: "tech", color: "#22c55e", description: null, created_at: "2026-01-01T00:00:00Z" },
];

const mockHighlight: HighlightWithTags = {
  id: "h1",
  user_id: "test-user-id",
  document_id: "d1",
  text: "This is a highlighted passage.",
  note: "Important insight",
  color: "#FFFF00",
  position_selector: null,
  position_percent: 25,
  created_at: "2026-02-15T10:00:00.000Z",
  updated_at: "2026-02-15T10:00:00.000Z",
  tags: [mockTags[0]],
};

describe("generateFrontmatter", () => {
  it("generates YAML frontmatter with all fields", () => {
    const fm = generateFrontmatter(mockDoc, mockTags);
    expect(fm).toContain("---");
    expect(fm).toContain("title: Test Article");
    expect(fm).toContain("author: Jane Doe");
    expect(fm).toContain("url: https://example.com/test");
    expect(fm).toContain("- reading");
    expect(fm).toContain("- tech");
    expect(fm).toContain("type: article");
    expect(fm).toContain("word_count: 500");
    expect(fm).toContain("reading_progress: 75");
  });

  it("omits null/undefined fields", () => {
    const minDoc = { ...mockDoc, author: null, url: null, published_at: null } as Document;
    const fm = generateFrontmatter(minDoc, []);
    expect(fm).not.toContain("author");
    expect(fm).not.toContain("url:");
    expect(fm).not.toContain("published_date");
    expect(fm).not.toContain("tags");
  });
});

describe("formatDocumentAsMarkdown", () => {
  it("includes frontmatter and content", () => {
    const md = formatDocumentAsMarkdown({
      document: mockDoc,
      tags: mockTags,
      highlights: [],
      markdownContent: "# Hello\n\nSome content here.",
    });
    expect(md).toContain("---");
    expect(md).toContain("title: Test Article");
    expect(md).toContain("# Hello");
    expect(md).toContain("Some content here.");
  });

  it("includes highlights appendix when present", () => {
    const md = formatDocumentAsMarkdown(
      {
        document: mockDoc,
        tags: mockTags,
        highlights: [mockHighlight],
        markdownContent: "Content.",
      },
      { includeHighlights: true, highlightFormat: "appendix" }
    );
    expect(md).toContain("## Highlights");
    expect(md).toContain("> This is a highlighted passage.");
    expect(md).toContain("**Note:** Important insight");
    expect(md).toContain("**Color:** Yellow");
    expect(md).toContain("#reading");
  });

  it("excludes highlights when disabled", () => {
    const md = formatDocumentAsMarkdown(
      {
        document: mockDoc,
        tags: [],
        highlights: [mockHighlight],
        markdownContent: "Content.",
      },
      { includeHighlights: false }
    );
    expect(md).not.toContain("## Highlights");
  });
});

describe("formatHighlightsAsMarkdown", () => {
  it("formats highlights grouped by document", () => {
    const highlights: HighlightWithDocument[] = [
      {
        ...mockHighlight,
        document: {
          id: "d1",
          title: "Test Article",
          url: "https://example.com/test",
          author: "Jane Doe",
          type: "article",
        },
      },
    ];
    const md = formatHighlightsAsMarkdown(highlights);
    expect(md).toContain("# Highlights Export");
    expect(md).toContain("## Test Article");
    expect(md).toContain("[Original](https://example.com/test)");
    expect(md).toContain("> This is a highlighted passage.");
  });

  it("returns empty string for no highlights", () => {
    expect(formatHighlightsAsMarkdown([])).toBe("");
  });
});
