import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET } from "@/app/api/settings/route";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/settings", () => {
  it("returns email domain setting", async () => {
    const req = createRequest("GET", "/api/settings");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.emailDomain).toBe("read.example.com");
  });
});
