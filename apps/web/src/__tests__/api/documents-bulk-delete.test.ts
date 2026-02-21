import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  bulkDeleteDocuments: vi.fn(),
  previewBulkDeleteDocuments: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { POST as bulkDeletePOST } from "@/app/api/documents/bulk-delete/route";
import { POST as previewPOST } from "@/app/api/documents/bulk-delete/preview/route";
import { bulkDeleteDocuments, previewBulkDeleteDocuments } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("POST /api/documents/bulk-delete/preview", () => {
  it("returns preview count", async () => {
    vi.mocked(previewBulkDeleteDocuments).mockResolvedValue(42 as never);

    const req = createRequest("POST", "/api/documents/bulk-delete/preview", {
      body: {
        filters: {
          location: "inbox",
          type: "rss",
        },
      },
    });
    const res = await previewPOST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(42);
    expect(previewBulkDeleteDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({ location: "inbox", type: "rss" })
    );
  });
});

describe("POST /api/documents/bulk-delete", () => {
  it("deletes selected documents", async () => {
    vi.mocked(bulkDeleteDocuments).mockResolvedValue(3 as never);

    const req = createRequest("POST", "/api/documents/bulk-delete", {
      body: {
        scope: "selected",
        ids: ["a", "b", "c"],
      },
    });
    const res = await bulkDeletePOST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { deletedCount: number };
    expect(body.deletedCount).toBe(3);
    expect(bulkDeleteDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      { scope: "selected", ids: ["a", "b", "c"] }
    );
  });

  it("deletes filtered documents", async () => {
    vi.mocked(bulkDeleteDocuments).mockResolvedValue(12 as never);

    const req = createRequest("POST", "/api/documents/bulk-delete", {
      body: {
        scope: "filtered",
        filters: {
          location: "inbox",
          type: "rss",
        },
      },
    });
    const res = await bulkDeletePOST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { deletedCount: number };
    expect(body.deletedCount).toBe(12);
    expect(bulkDeleteDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({
        scope: "filtered",
        query: expect.objectContaining({ location: "inbox", type: "rss" }),
      })
    );
  });

  it("returns 400 for invalid selected payload", async () => {
    const req = createRequest("POST", "/api/documents/bulk-delete", {
      body: {
        scope: "selected",
        ids: [],
      },
    });
    const res = await bulkDeletePOST(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_IDS");
  });
});
