import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getTags: vi.fn(),
  createNewTag: vi.fn(),
  patchTag: vi.fn(),
  removeTag: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, POST, OPTIONS } from "@/app/api/tags/route";
import { PATCH, DELETE } from "@/app/api/tags/[id]/route";
import { getTags, createNewTag, patchTag, removeTag } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/tags", () => {
  it("returns tags list", async () => {
    const mockTags = [{ id: "t1", name: "News", color: "#ff0000" }];
    vi.mocked(getTags).mockResolvedValue(mockTags as never);

    const req = createRequest("GET", "/api/tags");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("News");
  });

  it("includes CORS headers for allowed origins", async () => {
    vi.mocked(getTags).mockResolvedValue([] as never);

    const req = createRequest("GET", "/api/tags", {
      headers: { Origin: "chrome-extension://abc" },
    });
    const res = await GET(req);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://abc");
  });
});

describe("POST /api/tags", () => {
  it("creates tag", async () => {
    const mockTag = { id: "t1", name: "Tech", color: "#00ff00" };
    vi.mocked(createNewTag).mockResolvedValue(mockTag as never);

    const req = createRequest("POST", "/api/tags", {
      body: { name: "Tech", color: "#00ff00" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, any>;
    expect(body.name).toBe("Tech");
  });

  it("returns 400 when name missing", async () => {
    const req = createRequest("POST", "/api/tags", { body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_NAME");
  });
});

describe("PATCH /api/tags/[id]", () => {
  it("updates tag", async () => {
    vi.mocked(patchTag).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/tags/t1", {
      body: { name: "Updated" },
    });
    const res = await PATCH(req, routeParams("t1"));

    expect(res.status).toBe(200);
    expect(patchTag).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "t1", expect.objectContaining({ name: "Updated" }));
  });
});

describe("DELETE /api/tags/[id]", () => {
  it("removes tag", async () => {
    vi.mocked(removeTag).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/tags/t1");
    const res = await DELETE(req, routeParams("t1"));

    expect(res.status).toBe(200);
    expect(removeTag).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "t1");
  });
});

describe("OPTIONS /api/tags", () => {
  it("returns CORS preflight", async () => {
    const req = createRequest("OPTIONS", "/api/tags", {
      headers: { Origin: "http://localhost:3000" },
    });
    const res = await OPTIONS(req);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });
});
