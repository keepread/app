import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

vi.mock("@focus-reader/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@focus-reader/db")>();
  return { ...actual, listIngestionLogs: vi.fn() };
});

import { GET } from "@/app/api/ingestion-log/route";
import { listIngestionLogs } from "@focus-reader/db";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/ingestion-log", () => {
  it("returns ingestion log entries", async () => {
    const mockLogs = [{ id: "l1", source: "email", status: "success" }];
    vi.mocked(listIngestionLogs).mockResolvedValue(mockLogs as never);

    const req = createRequest("GET", "/api/ingestion-log");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
  });
});
