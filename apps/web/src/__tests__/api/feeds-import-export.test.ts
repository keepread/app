import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  importOpml: vi.fn(),
  exportOpml: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { POST } from "@/app/api/feeds/import/route";
import { GET } from "@/app/api/feeds/export/route";
import { importOpml, exportOpml } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("POST /api/feeds/import", () => {
  const sampleOpml = `<?xml version="1.0"?><opml version="2.0"><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>`;

  it("imports with multipart/form-data", async () => {
    vi.mocked(importOpml).mockResolvedValue({ imported: 1, skipped: 0 } as never);

    const formData = new FormData();
    const file = new File([sampleOpml], "feeds.opml", { type: "application/xml" });
    formData.append("file", file);

    const req = createRequest("POST", "/api/feeds/import", { formData });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(importOpml).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), sampleOpml);
  });

  it("imports with raw XML body", async () => {
    vi.mocked(importOpml).mockResolvedValue({ imported: 1, skipped: 0 } as never);

    const req = new Request("http://localhost:3000/api/feeds/import", {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: sampleOpml,
    });
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(req);
    const res = await POST(nextReq);

    expect(res.status).toBe(200);
    expect(importOpml).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), sampleOpml);
  });

  it("returns 400 when empty", async () => {
    const req = new Request("http://localhost:3000/api/feeds/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: "   ",
    });
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(req);
    const res = await POST(nextReq);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_BODY");
  });
});

describe("GET /api/feeds/export", () => {
  it("returns OPML XML", async () => {
    const opmlXml = `<?xml version="1.0"?><opml version="2.0"><body></body></opml>`;
    vi.mocked(exportOpml).mockResolvedValue(opmlXml);

    const req = createRequest("GET", "/api/feeds/export");
    const res = await GET(req);

    expect(res.headers.get("Content-Type")).toBe("application/xml");
    expect(res.headers.get("Content-Disposition")).toContain("focus-reader-feeds.opml");
    const text = await res.text();
    expect(text).toContain("<opml");
  });
});
