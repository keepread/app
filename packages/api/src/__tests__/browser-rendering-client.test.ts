import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRenderedHtml, BrowserRenderingError } from "../browser-rendering-client.js";

const CONFIG = {
  enabled: true,
  accountId: "test-account",
  apiToken: "test-token",
  timeoutMs: 5000,
};

function mockFetch(value: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(value));
}

describe("fetchRenderedHtml", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts HTML from the JSON envelope result field", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        success: true,
        result: "<html><body>Hello</body></html>",
        errors: [],
        messages: [],
      }),
    });
    const html = await fetchRenderedHtml("https://example.com", CONFIG);
    expect(html).toBe("<html><body>Hello</body></html>");
  });

  it("passes the URL in the request body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: "<html></html>", errors: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await fetchRenderedHtml("https://example.com/article", CONFIG);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com/article" });
  });

  it("throws a non-retryable error when success=false", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        success: false,
        result: null,
        errors: [{ message: "rendering failed" }],
      }),
    });
    const err = await fetchRenderedHtml("https://example.com", CONFIG).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(false);
    expect(err.message).toBe("rendering failed");
  });

  it("throws a non-retryable error when result is empty", async () => {
    mockFetch({
      ok: true,
      json: async () => ({ success: true, result: "", errors: [] }),
    });
    const err = await fetchRenderedHtml("https://example.com", CONFIG).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(false);
  });

  it("throws a retryable error on HTTP 429", async () => {
    mockFetch({ ok: false, status: 429 });
    const err = await fetchRenderedHtml("https://example.com", CONFIG).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(true);
  });

  it("throws a retryable error on HTTP 500", async () => {
    mockFetch({ ok: false, status: 500 });
    const err = await fetchRenderedHtml("https://example.com", CONFIG).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(true);
  });

  it("throws a non-retryable error on HTTP 404", async () => {
    mockFetch({ ok: false, status: 404 });
    const err = await fetchRenderedHtml("https://example.com", CONFIG).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(false);
  });

  it("throws a non-retryable error when disabled", async () => {
    const err = await fetchRenderedHtml("https://example.com", {
      ...CONFIG,
      enabled: false,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(false);
  });

  it("throws a retryable error on AbortError (timeout)", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    const err = await fetchRenderedHtml("https://example.com", CONFIG).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserRenderingError);
    expect((err as BrowserRenderingError).retryable).toBe(true);
    expect(err.message).toContain("timeout");
  });
});
