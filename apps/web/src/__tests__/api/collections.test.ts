import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getCollections: vi.fn(),
  getCollectionDetail: vi.fn(),
  createCollection: vi.fn(),
  patchCollection: vi.fn(),
  removeCollection: vi.fn(),
  addToCollection: vi.fn(),
  removeFromCollection: vi.fn(),
  reorderCollection: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET as listGET, POST as createPOST } from "@/app/api/collections/route";
import { GET as detailGET, PATCH, DELETE } from "@/app/api/collections/[id]/route";
import { POST as addDocPOST, DELETE as removeDocDELETE } from "@/app/api/collections/[id]/documents/route";
import { PUT as reorderPUT } from "@/app/api/collections/[id]/reorder/route";
import {
  getCollections,
  getCollectionDetail,
  createCollection,
  patchCollection,
  removeCollection,
  addToCollection,
  removeFromCollection,
  reorderCollection,
} from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/collections", () => {
  it("returns collections list", async () => {
    vi.mocked(getCollections).mockResolvedValue([
      { id: "c1", name: "Reading List", documentCount: 3 },
    ] as never);

    const req = createRequest("GET", "/api/collections");
    const res = await listGET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/collections", () => {
  it("creates collection", async () => {
    vi.mocked(createCollection).mockResolvedValue({ id: "c1", name: "New" } as never);

    const req = createRequest("POST", "/api/collections", {
      body: { name: "New", description: "A list" },
    });
    const res = await createPOST(req);

    expect(res.status).toBe(201);
  });

  it("returns 400 when name missing", async () => {
    const req = createRequest("POST", "/api/collections", { body: {} });
    const res = await createPOST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/collections/[id]", () => {
  it("returns collection detail", async () => {
    vi.mocked(getCollectionDetail).mockResolvedValue({
      id: "c1",
      name: "List",
      documents: [],
    } as never);

    const req = createRequest("GET", "/api/collections/c1");
    const res = await detailGET(req, routeParams("c1"));
    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent", async () => {
    vi.mocked(getCollectionDetail).mockResolvedValue(null as never);

    const req = createRequest("GET", "/api/collections/missing");
    const res = await detailGET(req, routeParams("missing"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/collections/[id]", () => {
  it("updates collection", async () => {
    vi.mocked(patchCollection).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/collections/c1", {
      body: { name: "Updated" },
    });
    const res = await PATCH(req, routeParams("c1"));

    expect(res.status).toBe(200);
    expect(patchCollection).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "c1", { name: "Updated" });
  });
});

describe("DELETE /api/collections/[id]", () => {
  it("deletes collection", async () => {
    vi.mocked(removeCollection).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/collections/c1");
    const res = await DELETE(req, routeParams("c1"));

    expect(res.status).toBe(200);
  });
});

describe("POST /api/collections/[id]/documents", () => {
  it("adds document to collection", async () => {
    vi.mocked(addToCollection).mockResolvedValue(undefined as never);

    const req = createRequest("POST", "/api/collections/c1/documents", {
      body: { documentId: "d1" },
    });
    const res = await addDocPOST(req, routeParams("c1"));

    expect(res.status).toBe(200);
    expect(addToCollection).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "c1", "d1");
  });

  it("returns 400 when documentId missing", async () => {
    const req = createRequest("POST", "/api/collections/c1/documents", { body: {} });
    const res = await addDocPOST(req, routeParams("c1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/collections/[id]/documents", () => {
  it("removes document from collection", async () => {
    vi.mocked(removeFromCollection).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/collections/c1/documents", {
      body: { documentId: "d1" },
    });
    const res = await removeDocDELETE(req, routeParams("c1"));

    expect(res.status).toBe(200);
  });
});

describe("PUT /api/collections/[id]/reorder", () => {
  it("reorders documents", async () => {
    vi.mocked(reorderCollection).mockResolvedValue(undefined as never);

    const req = createRequest("PUT", "/api/collections/c1/reorder", {
      body: { orderedDocumentIds: ["d3", "d1", "d2"] },
    });
    const res = await reorderPUT(req, routeParams("c1"));

    expect(res.status).toBe(200);
    expect(reorderCollection).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "c1", ["d3", "d1", "d2"]);
  });

  it("returns 400 when orderedDocumentIds missing", async () => {
    const req = createRequest("PUT", "/api/collections/c1/reorder", { body: {} });
    const res = await reorderPUT(req, routeParams("c1"));
    expect(res.status).toBe(400);
  });
});
