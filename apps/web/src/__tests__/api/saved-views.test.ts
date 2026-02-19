import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getSavedViews: vi.fn(),
  createView: vi.fn(),
  updateView: vi.fn(),
  deleteView: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

vi.mock("@focus-reader/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@focus-reader/db")>();
  return { ...actual, getSavedView: vi.fn() };
});

import { GET, POST } from "@/app/api/saved-views/route";
import { GET as GetById, PATCH, DELETE } from "@/app/api/saved-views/[id]/route";
import { getSavedViews, createView, updateView, deleteView } from "@focus-reader/api";
import { getSavedView } from "@focus-reader/db";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/saved-views", () => {
  it("lists saved views", async () => {
    const mockViews = [{ id: "v1", name: "Newsletters", query_ast_json: "{}" }];
    vi.mocked(getSavedViews).mockResolvedValue(mockViews as never);

    const req = createRequest("GET", "/api/saved-views");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
  });

  it("seeds default views when none exist", async () => {
    vi.mocked(getSavedViews)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ id: "v1", name: "Newsletters" }] as never);
    vi.mocked(createView).mockResolvedValue({ id: "v1" } as never);

    const req = createRequest("GET", "/api/saved-views");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(createView).toHaveBeenCalledTimes(3); // 3 default views
  });
});

describe("POST /api/saved-views", () => {
  it("creates saved view", async () => {
    const mockView = { id: "v1", name: "Custom", query_ast_json: '{"filters":[]}' };
    vi.mocked(createView).mockResolvedValue(mockView as never);

    const req = createRequest("POST", "/api/saved-views", {
      body: { name: "Custom", query_ast_json: '{"filters":[]}' },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("returns 400 when name or query_ast_json missing", async () => {
    const req = createRequest("POST", "/api/saved-views", {
      body: { name: "Custom" },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/saved-views/[id]", () => {
  it("returns single view", async () => {
    vi.mocked(getSavedView).mockResolvedValue({ id: "v1", name: "Test" } as never);

    const req = createRequest("GET", "/api/saved-views/v1");
    const res = await GetById(req, routeParams("v1"));

    expect(res.status).toBe(200);
  });

  it("returns 404 for nonexistent view", async () => {
    vi.mocked(getSavedView).mockResolvedValue(null as never);

    const req = createRequest("GET", "/api/saved-views/missing");
    const res = await GetById(req, routeParams("missing"));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/saved-views/[id]", () => {
  it("updates view", async () => {
    vi.mocked(updateView).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/saved-views/v1", {
      body: { name: "Updated" },
    });
    const res = await PATCH(req, routeParams("v1"));

    expect(res.status).toBe(200);
    expect(updateView).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      "v1",
      expect.objectContaining({ name: "Updated" })
    );
  });
});

describe("DELETE /api/saved-views/[id]", () => {
  it("removes view", async () => {
    vi.mocked(getSavedView).mockResolvedValue({ id: "v1", is_system: 0 } as never);
    vi.mocked(deleteView).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/saved-views/v1");
    const res = await DELETE(req, routeParams("v1"));

    expect(res.status).toBe(200);
    expect(deleteView).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "v1");
  });

  it("returns 400 for system view", async () => {
    vi.mocked(getSavedView).mockResolvedValue({ id: "v1", is_system: 1 } as never);

    const req = createRequest("DELETE", "/api/saved-views/v1");
    const res = await DELETE(req, routeParams("v1"));

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.message).toContain("system");
  });

  it("returns 404 for nonexistent view", async () => {
    vi.mocked(getSavedView).mockResolvedValue(null as never);

    const req = createRequest("DELETE", "/api/saved-views/missing");
    const res = await DELETE(req, routeParams("missing"));

    expect(res.status).toBe(404);
  });
});
