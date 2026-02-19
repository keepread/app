import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getDenylist: vi.fn(),
  addToDenylist: vi.fn(),
  removeFromDenylist: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, POST } from "@/app/api/denylist/route";
import { DELETE } from "@/app/api/denylist/[id]/route";
import { getDenylist, addToDenylist, removeFromDenylist } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/denylist", () => {
  it("returns denylist entries", async () => {
    const mockEntries = [{ id: "d1", domain: "spam.com", reason: "Spam" }];
    vi.mocked(getDenylist).mockResolvedValue(mockEntries as never);

    const req = createRequest("GET", "/api/denylist");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
    expect(body[0].domain).toBe("spam.com");
  });
});

describe("POST /api/denylist", () => {
  it("adds entry", async () => {
    const mockEntry = { id: "d1", domain: "spam.com", reason: "Spam" };
    vi.mocked(addToDenylist).mockResolvedValue(mockEntry as never);

    const req = createRequest("POST", "/api/denylist", {
      body: { domain: "spam.com", reason: "Spam" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("returns 400 when domain missing", async () => {
    const req = createRequest("POST", "/api/denylist", { body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_DOMAIN");
  });
});

describe("DELETE /api/denylist/[id]", () => {
  it("removes entry", async () => {
    vi.mocked(removeFromDenylist).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/denylist/d1");
    const res = await DELETE(req, routeParams("d1"));

    expect(res.status).toBe(200);
    expect(removeFromDenylist).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "d1");
  });
});
