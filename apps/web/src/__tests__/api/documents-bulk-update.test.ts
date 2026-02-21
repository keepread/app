import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  bulkMoveSelectedDocuments: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { PATCH as bulkUpdatePATCH } from "@/app/api/documents/bulk-update/route";
import { bulkMoveSelectedDocuments } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("PATCH /api/documents/bulk-update", () => {
  it("moves selected documents to later", async () => {
    vi.mocked(bulkMoveSelectedDocuments).mockResolvedValue(2 as never);

    const req = createRequest("PATCH", "/api/documents/bulk-update", {
      body: {
        scope: "selected",
        ids: ["a", "b"],
        location: "later",
      },
    });
    const res = await bulkUpdatePATCH(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { updatedCount: number };
    expect(body.updatedCount).toBe(2);
    expect(bulkMoveSelectedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      { scope: "selected", ids: ["a", "b"], location: "later" }
    );
  });

  it("moves filtered documents to archive", async () => {
    vi.mocked(bulkMoveSelectedDocuments).mockResolvedValue(12 as never);

    const req = createRequest("PATCH", "/api/documents/bulk-update", {
      body: {
        scope: "filtered",
        filters: { location: "inbox", type: "rss" },
        location: "archive",
      },
    });
    const res = await bulkUpdatePATCH(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { updatedCount: number };
    expect(body.updatedCount).toBe(12);
    expect(bulkMoveSelectedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({
        scope: "filtered",
        query: expect.objectContaining({ location: "inbox", type: "rss" }),
        location: "archive",
      })
    );
  });

  it("returns 400 for empty ids", async () => {
    const req = createRequest("PATCH", "/api/documents/bulk-update", {
      body: {
        scope: "selected",
        ids: [],
        location: "archive",
      },
    });
    const res = await bulkUpdatePATCH(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_IDS");
  });

  it("returns 400 for invalid location", async () => {
    const req = createRequest("PATCH", "/api/documents/bulk-update", {
      body: {
        scope: "selected",
        ids: ["a"],
        location: "trash",
      },
    });
    const res = await bulkUpdatePATCH(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_LOCATION");
  });
});
