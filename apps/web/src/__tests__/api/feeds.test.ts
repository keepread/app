import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getFeeds: vi.fn(),
  addFeed: vi.fn(),
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
import {
  getFeeds,
  addFeed,
  DuplicateFeedError,
  patchFeed,
  removeFeed,
  tagFeed,
  untagFeed,
} from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
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

    const req = createRequest("POST", "/api/feeds", {
      body: { url: "https://example.com/feed.xml" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
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
