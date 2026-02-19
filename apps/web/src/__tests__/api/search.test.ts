import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  searchDocuments: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET } from "@/app/api/search/route";
import { searchDocuments } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/search", () => {
  it("returns search results", async () => {
    const mockResults = { data: [{ id: "1", title: "Match" }], total: 1 };
    vi.mocked(searchDocuments).mockResolvedValue(mockResults as never);

    const req = createRequest("GET", "/api/search?q=test");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(searchDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({ q: "test" })
    );
  });

  it("returns 400 when q param is missing", async () => {
    const req = createRequest("GET", "/api/search");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_QUERY");
  });

  it("returns 400 when q param is empty", async () => {
    const req = createRequest("GET", "/api/search?q=");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });
});
