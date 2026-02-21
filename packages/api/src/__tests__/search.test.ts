import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserScopedDb } from "@focus-reader/db";

vi.mock("@focus-reader/db", () => ({
  searchDocuments: vi.fn(),
  getDocumentWithTags: vi.fn(),
}));

const { searchDocuments: dbSearch, getDocumentWithTags } = await import(
  "@focus-reader/db"
);
const { searchDocuments } = await import("../search.js");

const mockDb = {} as D1Database;
const mockCtx = { db: mockDb, userId: "test-user-id" } as unknown as UserScopedDb;

describe("searchDocuments (API)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hydrated results with snippets", async () => {
    vi.mocked(dbSearch).mockResolvedValue({
      results: [
        { documentId: "doc-1", snippet: "…<mark>test</mark>…", rank: -1.5 },
        { documentId: "doc-2", snippet: "…<mark>test</mark> two…", rank: -1.2 },
      ],
      total: 2,
    });

    vi.mocked(getDocumentWithTags).mockImplementation(async (_ctx, id) => ({
      id,
      user_id: "test-user-id",
      type: "article" as const,
      url: null,
      title: `Doc ${id}`,
      author: null,
      author_url: null,
      site_name: null,
      excerpt: null,
      word_count: 100,
      reading_time_minutes: 1,
      cover_image_url: null,
      html_content: null,
      markdown_content: null,
      plain_text_content: null,
      location: "inbox" as const,
      is_read: 0,
      is_starred: 0,
      reading_progress: 0,
      last_read_at: null,
      saved_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      lang: null,
      updated_at: "2025-01-01T00:00:00.000Z",
      deleted_at: null,
      source_id: null,
      origin_type: "manual" as const,
      tags: [],
    }));

    const result = await searchDocuments(mockCtx, { q: "test" });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].snippet).toBe("…<mark>test</mark>…");
    expect(result.items[0].id).toBe("doc-1");
    expect(result.items[1].snippet).toBe("…<mark>test</mark> two…");
    expect(result.items[1].id).toBe("doc-2");
  });

  it("returns empty results when DB returns no matches", async () => {
    vi.mocked(dbSearch).mockResolvedValue({
      results: [],
      total: 0,
    });

    const result = await searchDocuments(mockCtx, { q: "nonexistent" });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
