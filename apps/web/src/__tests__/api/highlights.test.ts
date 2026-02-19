import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getHighlightsForDocument: vi.fn(),
  getAllHighlights: vi.fn(),
  createHighlight: vi.fn(),
  patchHighlight: vi.fn(),
  removeHighlight: vi.fn(),
  tagHighlight: vi.fn(),
  untagHighlight: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

vi.mock("@focus-reader/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@focus-reader/db")>();
  return { ...actual, getHighlightWithTags: vi.fn() };
});

import { GET as docHighlightsGET, POST as docHighlightsPOST } from "@/app/api/documents/[id]/highlights/route";
import { GET as allHighlightsGET } from "@/app/api/highlights/route";
import { GET as highlightGET, PATCH as highlightPATCH, DELETE as highlightDELETE } from "@/app/api/highlights/[id]/route";
import { POST as tagPOST, DELETE as tagDELETE } from "@/app/api/highlights/[id]/tags/route";
import {
  getHighlightsForDocument,
  getAllHighlights,
  createHighlight,
  patchHighlight,
  removeHighlight,
  tagHighlight,
  untagHighlight,
} from "@focus-reader/api";
import { getHighlightWithTags } from "@focus-reader/db";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/documents/[id]/highlights", () => {
  it("returns highlights for document", async () => {
    const mockHighlights = [
      { id: "h1", document_id: "d1", text: "Test", color: "#FFFF00", tags: [] },
    ];
    vi.mocked(getHighlightsForDocument).mockResolvedValue(mockHighlights as never);

    const req = createRequest("GET", "/api/documents/d1/highlights");
    const res = await docHighlightsGET(req, routeParams("d1"));

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(getHighlightsForDocument).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "d1");
  });
});

describe("POST /api/documents/[id]/highlights", () => {
  it("creates highlight", async () => {
    const mockHighlight = {
      id: "h1",
      document_id: "d1",
      text: "Highlighted text",
      color: "#FFFF00",
      tags: [],
    };
    vi.mocked(createHighlight).mockResolvedValue(mockHighlight as never);

    const req = createRequest("POST", "/api/documents/d1/highlights", {
      body: { text: "Highlighted text", color: "#90EE90" },
    });
    const res = await docHighlightsPOST(req, routeParams("d1"));

    expect(res.status).toBe(201);
    expect(createHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({
        document_id: "d1",
        text: "Highlighted text",
        color: "#90EE90",
      })
    );
  });

  it("returns 400 when text missing", async () => {
    const req = createRequest("POST", "/api/documents/d1/highlights", {
      body: { color: "#FFFF00" },
    });
    const res = await docHighlightsPOST(req, routeParams("d1"));

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect((body.error as Record<string, string>).code).toBe("MISSING_TEXT");
  });
});

describe("GET /api/highlights", () => {
  it("returns paginated highlights", async () => {
    const mockResult = {
      items: [{ id: "h1", text: "Test", document: { id: "d1", title: "Article" }, tags: [] }],
      total: 1,
    };
    vi.mocked(getAllHighlights).mockResolvedValue(mockResult as never);

    const req = createRequest("GET", "/api/highlights");
    const res = await allHighlightsGET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body as { items: unknown[] }).items).toHaveLength(1);
  });

  it("passes filter params", async () => {
    vi.mocked(getAllHighlights).mockResolvedValue({ items: [], total: 0 } as never);

    const req = createRequest("GET", "/api/highlights?color=%2390EE90&tagId=t1&limit=10");
    await allHighlightsGET(req);

    expect(getAllHighlights).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({
        color: "#90EE90",
        tagId: "t1",
        limit: 10,
      })
    );
  });
});

describe("GET /api/highlights/[id]", () => {
  it("returns highlight with tags", async () => {
    const mockHighlight = { id: "h1", text: "Test", tags: [] };
    vi.mocked(getHighlightWithTags).mockResolvedValue(mockHighlight as never);

    const req = createRequest("GET", "/api/highlights/h1");
    const res = await highlightGET(req, routeParams("h1"));

    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent highlight", async () => {
    vi.mocked(getHighlightWithTags).mockResolvedValue(null as never);

    const req = createRequest("GET", "/api/highlights/missing");
    const res = await highlightGET(req, routeParams("missing"));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/highlights/[id]", () => {
  it("updates highlight", async () => {
    vi.mocked(patchHighlight).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/highlights/h1", {
      body: { note: "Updated note", color: "#FF6B6B" },
    });
    const res = await highlightPATCH(req, routeParams("h1"));

    expect(res.status).toBe(200);
    expect(patchHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      "h1",
      expect.objectContaining({ note: "Updated note", color: "#FF6B6B" })
    );
  });
});

describe("DELETE /api/highlights/[id]", () => {
  it("deletes highlight", async () => {
    vi.mocked(removeHighlight).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/highlights/h1");
    const res = await highlightDELETE(req, routeParams("h1"));

    expect(res.status).toBe(200);
    expect(removeHighlight).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "h1");
  });
});

describe("POST /api/highlights/[id]/tags", () => {
  it("adds tag to highlight", async () => {
    vi.mocked(tagHighlight).mockResolvedValue(undefined as never);

    const req = createRequest("POST", "/api/highlights/h1/tags", {
      body: { tagId: "t1" },
    });
    const res = await tagPOST(req, routeParams("h1"));

    expect(res.status).toBe(200);
    expect(tagHighlight).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "h1", "t1");
  });

  it("returns 400 when tagId missing", async () => {
    const req = createRequest("POST", "/api/highlights/h1/tags", {
      body: {},
    });
    const res = await tagPOST(req, routeParams("h1"));

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/highlights/[id]/tags", () => {
  it("removes tag from highlight", async () => {
    vi.mocked(untagHighlight).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/highlights/h1/tags", {
      body: { tagId: "t1" },
    });
    const res = await tagDELETE(req, routeParams("h1"));

    expect(res.status).toBe(200);
    expect(untagHighlight).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "h1", "t1");
  });

  it("returns 400 when tagId missing", async () => {
    const req = createRequest("DELETE", "/api/highlights/h1/tags", {
      body: {},
    });
    const res = await tagDELETE(req, routeParams("h1"));

    expect(res.status).toBe(400);
  });
});
