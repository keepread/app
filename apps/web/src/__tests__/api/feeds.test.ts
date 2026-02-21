import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getFeeds: vi.fn(),
  addFeed: vi.fn(),
  pollSingleFeed: vi.fn(),
  DuplicateFeedError: class DuplicateFeedError extends Error {},
  patchFeed: vi.fn(),
  removeFeed: vi.fn(),
  tagFeed: vi.fn(),
  untagFeed: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, POST } from "@/app/api/feeds/route";
import { PATCH, DELETE } from "@/app/api/feeds/[id]/route";
import { POST as TagPOST, DELETE as TagDELETE } from "@/app/api/feeds/[id]/tags/route";
import { getExtractionQueue } from "@/lib/bindings";
import {
  getFeeds,
  addFeed,
  pollSingleFeed,
  DuplicateFeedError,
  patchFeed,
  removeFeed,
  tagFeed,
  untagFeed,
} from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
  vi.mocked(getExtractionQueue).mockResolvedValue(null);
});

describe("GET /api/feeds", () => {
  it("returns feeds list", async () => {
    const mockFeeds = [{ id: "f1", url: "https://example.com/feed.xml", title: "Test Feed" }];
    vi.mocked(getFeeds).mockResolvedValue(mockFeeds as never);

    const req = createRequest("GET", "/api/feeds");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/feeds", () => {
  it("adds feed", async () => {
    const mockFeed = { id: "f1", url: "https://example.com/feed.xml" };
    vi.mocked(addFeed).mockResolvedValue(mockFeed as never);
    vi.mocked(pollSingleFeed).mockResolvedValue({
      feedId: "f1",
      success: true,
      newItems: 0,
    } as never);

    const req = createRequest("POST", "/api/feeds", {
      body: { url: "https://example.com/feed.xml" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(pollSingleFeed).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      "f1",
      undefined,
      undefined
    );
  });

  it("passes queue-backed callbacks to immediate poll", async () => {
    const mockFeed = { id: "f1", url: "https://example.com/feed.xml" };
    const send = vi.fn().mockResolvedValue(undefined);
    vi.mocked(addFeed).mockResolvedValue(mockFeed as never);
    vi.mocked(getExtractionQueue).mockResolvedValue({ send } as unknown as Queue);
    vi.mocked(pollSingleFeed).mockImplementation(
      async (_ctx, _feedId, onLowQuality, onCoverImage) => {
        await onLowQuality?.({
          documentId: "doc-1",
          userId: "test-user-id",
          url: "https://example.com/post-1",
          source: "rss_full_content",
          score: 42,
        });
        await onCoverImage?.("test-user-id", "doc-1");
        return { feedId: "f1", success: true, newItems: 1 };
      }
    );

    const req = createRequest("POST", "/api/feeds", {
      body: { url: "https://example.com/feed.xml" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(pollSingleFeed).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      "f1",
      expect.any(Function),
      expect.any(Function)
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "test-user-id",
        document_id: "doc-1",
        source: "rss_full_content",
        url: "https://example.com/post-1",
      })
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "test-user-id",
        document_id: "doc-1",
        source: "rss_full_content",
        job_type: "image_cache",
      })
    );
  });

  it("returns 400 when url missing", async () => {
    const req = createRequest("POST", "/api/feeds", { body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_URL");
  });

  it("returns 409 on duplicate feed", async () => {
    vi.mocked(addFeed).mockRejectedValue(new DuplicateFeedError("dup"));

    const req = createRequest("POST", "/api/feeds", {
      body: { url: "https://example.com/feed.xml" },
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/feeds/[id]", () => {
  it("updates feed", async () => {
    vi.mocked(patchFeed).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/feeds/f1", {
      body: { title: "Updated" },
    });
    const res = await PATCH(req, routeParams("f1"));

    expect(res.status).toBe(200);
    expect(patchFeed).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "f1", expect.objectContaining({ title: "Updated" }));
  });

  it("handles addTagId", async () => {
    vi.mocked(tagFeed).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/feeds/f1", {
      body: { addTagId: "tag1" },
    });
    const res = await PATCH(req, routeParams("f1"));

    expect(res.status).toBe(200);
    expect(tagFeed).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "f1", "tag1");
  });
});

describe("DELETE /api/feeds/[id]", () => {
  it("removes feed", async () => {
    vi.mocked(removeFeed).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/feeds/f1");
    const res = await DELETE(req, routeParams("f1"));

    expect(res.status).toBe(200);
    expect(removeFeed).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "f1", false);
  });
});

describe("POST /api/feeds/[id]/tags", () => {
  it("adds tag to feed", async () => {
    vi.mocked(tagFeed).mockResolvedValue(undefined as never);

    const req = createRequest("POST", "/api/feeds/f1/tags", {
      body: { tagId: "tag1" },
    });
    const res = await TagPOST(req, routeParams("f1"));

    expect(res.status).toBe(200);
    expect(tagFeed).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "f1", "tag1");
  });

  it("returns 400 when tagId missing", async () => {
    const req = createRequest("POST", "/api/feeds/f1/tags", { body: {} });
    const res = await TagPOST(req, routeParams("f1"));

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/feeds/[id]/tags", () => {
  it("removes tag from feed", async () => {
    vi.mocked(untagFeed).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/feeds/f1/tags", {
      body: { tagId: "tag1" },
    });
    const res = await TagDELETE(req, routeParams("f1"));

    expect(res.status).toBe(200);
    expect(untagFeed).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "f1", "tag1");
  });
});
