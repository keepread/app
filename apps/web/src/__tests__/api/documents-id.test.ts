import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getDocumentDetail: vi.fn(),
  patchDocument: vi.fn(),
  removeDocument: vi.fn(),
  tagDocument: vi.fn(),
  untagDocument: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, PATCH, DELETE } from "@/app/api/documents/[id]/route";
import { getDocumentDetail, patchDocument, tagDocument, untagDocument, removeDocument } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/documents/[id]", () => {
  it("returns document by ID", async () => {
    const mockDoc = { id: "doc1", title: "Test Doc", url: "https://example.com" };
    vi.mocked(getDocumentDetail).mockResolvedValue(mockDoc as never);

    const req = createRequest("GET", "/api/documents/doc1");
    const res = await GET(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.id).toBe("doc1");
  });

  it("returns 404 for nonexistent document", async () => {
    vi.mocked(getDocumentDetail).mockResolvedValue(null as never);

    const req = createRequest("GET", "/api/documents/missing");
    const res = await GET(req, routeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/documents/[id]", () => {
  it("updates document fields", async () => {
    vi.mocked(patchDocument).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/documents/doc1", {
      body: { title: "Updated Title", is_read: 1 },
    });
    const res = await PATCH(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    expect(patchDocument).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      "doc1",
      expect.objectContaining({ title: "Updated Title", is_read: 1 })
    );
  });

  it("handles addTagId", async () => {
    vi.mocked(tagDocument).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/documents/doc1", {
      body: { addTagId: "tag1" },
    });
    const res = await PATCH(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    expect(tagDocument).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "doc1", "tag1");
  });

  it("handles removeTagId", async () => {
    vi.mocked(untagDocument).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/documents/doc1", {
      body: { removeTagId: "tag1" },
    });
    const res = await PATCH(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    expect(untagDocument).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "doc1", "tag1");
  });
});

describe("DELETE /api/documents/[id]", () => {
  it("soft-deletes document", async () => {
    vi.mocked(removeDocument).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/documents/doc1");
    const res = await DELETE(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    expect(removeDocument).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "doc1");
  });
});
