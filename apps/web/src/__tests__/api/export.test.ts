import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  exportAllJson: vi.fn(),
  exportDocumentMarkdown: vi.fn(),
  exportBulkMarkdown: vi.fn(),
  exportHighlightsMarkdown: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, method: "cf-access" }),
}));

vi.mock("jszip", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    })),
  };
});

import { GET as jsonGET } from "@/app/api/export/json/route";
import { GET as markdownGET } from "@/app/api/export/markdown/route";
import { GET as docExportGET } from "@/app/api/documents/[id]/export/route";
import {
  exportAllJson,
  exportDocumentMarkdown,
  exportBulkMarkdown,
  exportHighlightsMarkdown,
} from "@focus-reader/api";

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/export/json", () => {
  it("returns JSON download", async () => {
    vi.mocked(exportAllJson).mockResolvedValue({ documents: [], highlights: [] });

    const req = createRequest("GET", "/api/export/json");
    const res = await jsonGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });
});

describe("GET /api/export/markdown", () => {
  it("returns highlights markdown", async () => {
    vi.mocked(exportHighlightsMarkdown).mockResolvedValue("# Highlights\n");

    const req = createRequest("GET", "/api/export/markdown?mode=highlights");
    const res = await markdownGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
  });

  it("returns ZIP for document export", async () => {
    vi.mocked(exportBulkMarkdown).mockResolvedValue([
      { filename: "test.md", content: "# Test\n" },
    ]);

    const req = createRequest("GET", "/api/export/markdown?mode=documents");
    const res = await markdownGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });
});

describe("GET /api/documents/[id]/export", () => {
  it("returns markdown for a document", async () => {
    vi.mocked(exportDocumentMarkdown).mockResolvedValue("---\ntitle: Test\n---\n");

    const req = createRequest("GET", "/api/documents/d1/export");
    const res = await docExportGET(req, routeParams("d1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
  });

  it("returns 404 when document not found", async () => {
    vi.mocked(exportDocumentMarkdown).mockResolvedValue(null);

    const req = createRequest("GET", "/api/documents/missing/export");
    const res = await docExportGET(req, routeParams("missing"));

    expect(res.status).toBe(404);
  });
});
