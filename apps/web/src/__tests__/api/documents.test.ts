import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

// Mock @focus-reader/api
vi.mock("@focus-reader/api", () => ({
  getDocuments: vi.fn(),
  createBookmark: vi.fn(),
  DuplicateUrlError: class DuplicateUrlError extends Error {},
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, POST, OPTIONS } from "@/app/api/documents/route";
import { getDocuments, createBookmark, DuplicateUrlError } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/documents", () => {
  it("returns paginated documents list", async () => {
    const mockResult = { data: [{ id: "1", title: "Test" }], cursor: null };
    vi.mocked(getDocuments).mockResolvedValue(mockResult as never);

    const req = createRequest("GET", "/api/documents?limit=10");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.data).toHaveLength(1);
    expect(getDocuments).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), expect.objectContaining({ limit: 10 }));
  });

  it("passes query params correctly", async () => {
    vi.mocked(getDocuments).mockResolvedValue({ data: [], cursor: null } as never);

    const req = createRequest("GET", "/api/documents?location=inbox&status=unread&tagId=t1&type=article&isStarred=true");
    await GET(req);

    expect(getDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({
        location: "inbox",
        status: "unread",
        tagId: "t1",
        type: "article",
        isStarred: true,
      })
    );
  });
});

describe("POST /api/documents", () => {
  it("creates a bookmark", async () => {
    const mockDoc = { id: "1", url: "https://example.com", title: "Example" };
    vi.mocked(createBookmark).mockResolvedValue(mockDoc as never);

    const req = createRequest("POST", "/api/documents", {
      body: { url: "https://example.com", type: "bookmark" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, any>;
    expect(body.url).toBe("https://example.com");
  });

  it("returns 400 when url is missing", async () => {
    const req = createRequest("POST", "/api/documents", { body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_URL");
  });

  it("returns 409 on duplicate URL", async () => {
    vi.mocked(createBookmark).mockRejectedValue(new DuplicateUrlError("dup"));

    const req = createRequest("POST", "/api/documents", {
      body: { url: "https://example.com" },
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("DUPLICATE_URL");
  });
});

describe("OPTIONS /api/documents", () => {
  it("returns 204 with CORS headers for allowed origins", async () => {
    const req = createRequest("OPTIONS", "/api/documents", {
      headers: { Origin: "chrome-extension://abc123" },
    });
    const res = await OPTIONS(req);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://abc123");
  });

  it("returns 403 for disallowed origins", async () => {
    const req = createRequest("OPTIONS", "/api/documents", {
      headers: { Origin: "https://evil.com" },
    });
    const res = await OPTIONS(req);

    expect(res.status).toBe(403);
  });
});

describe("CORS headers on responses", () => {
  it("includes CORS headers when origin is chrome-extension://", async () => {
    vi.mocked(getDocuments).mockResolvedValue({ data: [], cursor: null } as never);

    const req = createRequest("GET", "/api/documents", {
      headers: { Origin: "chrome-extension://abc123" },
    });
    const res = await GET(req);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://abc123");
  });
});
