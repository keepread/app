import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  tagDocument: vi.fn(),
  untagDocument: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { POST, DELETE } from "@/app/api/documents/[id]/tags/route";
import { tagDocument, untagDocument } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("POST /api/documents/[id]/tags", () => {
  it("adds tag to document", async () => {
    vi.mocked(tagDocument).mockResolvedValue(undefined as never);

    const req = createRequest("POST", "/api/documents/doc1/tags", {
      body: { tagId: "tag1" },
    });
    const res = await POST(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    expect(tagDocument).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "doc1", "tag1");
  });

  it("returns 400 when tagId missing", async () => {
    const req = createRequest("POST", "/api/documents/doc1/tags", {
      body: {},
    });
    const res = await POST(req, routeParams("doc1"));

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_TAG_ID");
  });
});

describe("DELETE /api/documents/[id]/tags", () => {
  it("removes tag from document", async () => {
    vi.mocked(untagDocument).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/documents/doc1/tags", {
      body: { tagId: "tag1" },
    });
    const res = await DELETE(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    expect(untagDocument).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "doc1", "tag1");
  });

  it("returns 400 when tagId missing", async () => {
    const req = createRequest("DELETE", "/api/documents/doc1/tags", {
      body: {},
    });
    const res = await DELETE(req, routeParams("doc1"));

    expect(res.status).toBe(400);
  });
});
