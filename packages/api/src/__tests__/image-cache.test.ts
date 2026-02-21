import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@focus-reader/db", () => ({
  getDocument: vi.fn(),
  enrichDocument: vi.fn(),
}));

const { getDocument, enrichDocument } = await import("@focus-reader/db");
const { cacheDocumentCoverImage } = await import("../image-cache.js");

import type { UserScopedDb } from "@focus-reader/db";

const mockCtx: UserScopedDb = { db: {} as D1Database, userId: "user-1" };

function makeR2(obj: { body: ArrayBuffer; contentType?: string } | null): R2Bucket {
  return {
    get: vi.fn().mockResolvedValue(
      obj
        ? {
            body: obj.body,
            httpMetadata: { contentType: obj.contentType ?? "image/jpeg" },
          }
        : null
    ),
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as R2Bucket;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("cacheDocumentCoverImage", () => {
  it("returns document_missing when document does not exist", async () => {
    vi.mocked(getDocument).mockResolvedValue(null);
    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("document_missing");
  });

  it("returns document_missing for soft-deleted document", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: "2026-01-01T00:00:00Z",
      cover_image_r2_key: null,
      cover_image_url: "https://example.com/img.jpg",
    } as any);
    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("document_missing");
  });

  it("returns already_cached when r2 key already set", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: "covers/doc-1.jpg",
      cover_image_url: "https://example.com/img.jpg",
    } as any);
    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("already_cached");
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("returns skipped when no cover_image_url", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: null,
      cover_image_url: null,
    } as any);
    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("skipped");
  });

  it("caches image and returns cached status on success", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: null,
      cover_image_url: "https://example.com/img.jpg",
    } as any);
    vi.mocked(enrichDocument).mockResolvedValue(undefined);

    const imageBody = new Uint8Array([1, 2, 3]).buffer;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => imageBody,
    });
    vi.stubGlobal("fetch", mockFetch);

    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");

    expect(result.status).toBe("cached");
    expect(result.r2Key).toBe("covers/doc-1.jpg");
    expect(r2.put).toHaveBeenCalledWith(
      "covers/doc-1.jpg",
      imageBody,
      { httpMetadata: { contentType: "image/jpeg" } }
    );
    expect(enrichDocument).toHaveBeenCalledWith(mockCtx, "doc-1", {
      cover_image_r2_key: "covers/doc-1.jpg",
    });
  });

  it("returns failed when fetch returns non-ok response", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: null,
      cover_image_url: "https://example.com/img.jpg",
    } as any);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("failed");
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("returns failed for disallowed content type", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: null,
      cover_image_url: "https://example.com/img.svg",
    } as any);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/svg+xml" },
      arrayBuffer: async () => new ArrayBuffer(10),
    }));

    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("failed");
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("returns skipped when image exceeds size limit", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: null,
      cover_image_url: "https://example.com/img.jpg",
    } as any);

    const oversized = new ArrayBuffer(6 * 1024 * 1024); // 6MB > 5MB limit
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => oversized,
    }));

    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("skipped");
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("returns failed when fetch throws", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: "doc-1",
      deleted_at: null,
      cover_image_r2_key: null,
      cover_image_url: "https://example.com/img.jpg",
    } as any);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const r2 = makeR2(null);
    const result = await cacheDocumentCoverImage(mockCtx, r2, "doc-1");
    expect(result.status).toBe("failed");
  });
});
