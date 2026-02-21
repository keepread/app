import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@focus-reader/db", () => ({
  getDocument: vi.fn(),
  enrichDocument: vi.fn(),
}));

vi.mock("@focus-reader/parser", () => ({
  extractArticle: vi.fn(),
  extractMetadata: vi.fn(),
}));

vi.mock("../browser-rendering-client.js", () => ({
  fetchRenderedHtml: vi.fn(),
  BrowserRenderingError: class BrowserRenderingError extends Error {
    retryable: boolean;
    constructor(message: string, retryable: boolean) {
      super(message);
      this.name = "BrowserRenderingError";
      this.retryable = retryable;
    }
  },
}));

const { getDocument, enrichDocument } = await import("@focus-reader/db");
const { extractArticle, extractMetadata } = await import("@focus-reader/parser");
const { fetchRenderedHtml, BrowserRenderingError } = await import(
  "../browser-rendering-client.js"
);
const { processEnrichmentJob } = await import("../enrichment-consumer.js");

import type { UserScopedDb } from "@focus-reader/db";
import type { ExtractionEnrichmentJob } from "@focus-reader/shared";

const mockCtx: UserScopedDb = { db: {} as D1Database, userId: "user-1" };

const mockJob: ExtractionEnrichmentJob = {
  job_id: "job-1",
  user_id: "user-1",
  document_id: "doc-1",
  url: "https://example.com/article",
  source: "manual_url",
  attempt: 1,
  enqueued_at: "2026-01-01T00:00:00Z",
};

const mockRenderConfig = {
  enabled: true,
  accountId: "acct",
  apiToken: "token",
  timeoutMs: 5000,
};

const lowQualityDoc = {
  id: "doc-1",
  user_id: "user-1",
  deleted_at: null,
  title: "Untitled",
  url: "https://example.com/article",
  html_content: null,
  plain_text_content: null,
  author: null,
  site_name: null,
  published_at: null,
  cover_image_url: null,
  excerpt: null,
  word_count: 0,
  reading_time_minutes: 1,
  lang: null,
};

const goodArticle = {
  title: "A Good Article",
  author: "Jane",
  htmlContent: "<p>" + "x".repeat(3000) + "</p>",
  markdownContent: "x".repeat(3000),
  excerpt: "An interesting excerpt about something important here",
  wordCount: 400,
  readingTimeMinutes: 2,
  siteName: "Example Blog",
  readabilitySucceeded: true,
};

const goodMeta = {
  title: "A Good Article",
  author: "Jane",
  siteName: "Example Blog",
  ogImage: "https://example.com/hero.jpg",
  description: "An interesting excerpt about something important here",
  publishedDate: "2026-01-01T00:00:00Z",
  lang: "en",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(enrichDocument).mockResolvedValue(undefined as never);
});

describe("processEnrichmentJob", () => {
  it("returns document_missing when document not found", async () => {
    vi.mocked(getDocument).mockResolvedValue(null);
    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);
    expect(outcome.status).toBe("document_missing");
    expect(fetchRenderedHtml).not.toHaveBeenCalled();
  });

  it("returns document_missing when document is soft-deleted", async () => {
    vi.mocked(getDocument).mockResolvedValue({ ...lowQualityDoc, deleted_at: "2026-01-01" } as never);
    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);
    expect(outcome.status).toBe("document_missing");
  });

  it("returns skipped when user_id does not match", async () => {
    vi.mocked(getDocument).mockResolvedValue({ ...lowQualityDoc, user_id: "other-user" } as never);
    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);
    expect(outcome.status).toBe("skipped");
    expect(fetchRenderedHtml).not.toHaveBeenCalled();
  });

  it("returns render_failed for non-retryable BrowserRenderingError", async () => {
    vi.mocked(getDocument).mockResolvedValue(lowQualityDoc as never);
    vi.mocked(fetchRenderedHtml).mockRejectedValue(
      new BrowserRenderingError("404 Not Found", false)
    );
    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);
    expect(outcome.status).toBe("render_failed");
    expect(outcome.scoreBefore).toBeDefined();
  });

  it("re-throws retryable BrowserRenderingError for queue retry", async () => {
    vi.mocked(getDocument).mockResolvedValue(lowQualityDoc as never);
    vi.mocked(fetchRenderedHtml).mockRejectedValue(
      new BrowserRenderingError("503 Service Unavailable", true)
    );
    await expect(
      processEnrichmentJob(mockCtx, mockJob, mockRenderConfig)
    ).rejects.toBeInstanceOf(BrowserRenderingError);
    expect(enrichDocument).not.toHaveBeenCalled();
  });

  it("returns no_improvement when enriched score does not improve enough", async () => {
    // Document already has some content, so oldContentPresent = true
    const docWithContent = {
      ...lowQualityDoc,
      html_content: "<p>existing content</p>",
      plain_text_content: "existing content",
      word_count: 5,
    };
    vi.mocked(getDocument).mockResolvedValue(docWithContent as never);
    vi.mocked(fetchRenderedHtml).mockResolvedValue("<html><body>minimal</body></html>");
    // New extraction is similarly low quality — score delta < 10
    vi.mocked(extractArticle).mockReturnValue({
      title: "Untitled",
      author: null,
      htmlContent: "<p>minimal</p>",
      markdownContent: "minimal",
      excerpt: null,
      wordCount: 1,
      readingTimeMinutes: 1,
      siteName: null,
      readabilitySucceeded: false,
    } as never);
    vi.mocked(extractMetadata).mockReturnValue({
      title: null, author: null, siteName: null,
      ogImage: null, description: null, publishedDate: null, lang: null,
    } as never);
    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);
    expect(outcome.status).toBe("no_improvement");
    expect(enrichDocument).not.toHaveBeenCalled();
  });

  it("returns applied and calls enrichDocument when content meaningfully improves", async () => {
    vi.mocked(getDocument).mockResolvedValue(lowQualityDoc as never);
    vi.mocked(fetchRenderedHtml).mockResolvedValue("<html><body>...</body></html>");
    vi.mocked(extractArticle).mockReturnValue(goodArticle as never);
    vi.mocked(extractMetadata).mockReturnValue(goodMeta as never);

    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);

    expect(outcome.status).toBe("applied");
    expect(outcome.scoreBefore).toBeDefined();
    expect(outcome.scoreAfter).toBeGreaterThan(outcome.scoreBefore!);
    expect(enrichDocument).toHaveBeenCalledOnce();
    expect(enrichDocument).toHaveBeenCalledWith(
      mockCtx,
      "doc-1",
      expect.objectContaining({ title: "A Good Article" })
    );
  });

  it("includes render latency in all outcomes", async () => {
    vi.mocked(getDocument).mockResolvedValue(lowQualityDoc as never);
    vi.mocked(fetchRenderedHtml).mockResolvedValue("<html></html>");
    vi.mocked(extractArticle).mockReturnValue(goodArticle as never);
    vi.mocked(extractMetadata).mockReturnValue(goodMeta as never);

    const outcome = await processEnrichmentJob(mockCtx, mockJob, mockRenderConfig);
    expect(typeof outcome.renderLatencyMs).toBe("number");
    expect(outcome.renderLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
