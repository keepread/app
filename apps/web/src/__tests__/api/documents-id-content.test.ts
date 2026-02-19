import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, mockR2, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getDocumentDetail: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

vi.mock("@focus-reader/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@focus-reader/db")>();
  return { ...actual, getPdfMeta: vi.fn() };
});

import { GET } from "@/app/api/documents/[id]/content/route";
import { getDocumentDetail } from "@focus-reader/api";
import { getPdfMeta } from "@focus-reader/db";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/documents/[id]/content", () => {
  it("returns html/markdown content for non-PDF", async () => {
    vi.mocked(getDocumentDetail).mockResolvedValue({
      id: "doc1",
      type: "article",
      title: "Test",
      html_content: "<p>Hello</p>",
      markdown_content: "Hello",
    } as never);

    const req = createRequest("GET", "/api/documents/doc1/content");
    const res = await GET(req, routeParams("doc1"));

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.htmlContent).toBe("<p>Hello</p>");
    expect(body.markdownContent).toBe("Hello");
  });

  it("returns PDF binary from R2 for PDF documents", async () => {
    vi.mocked(getDocumentDetail).mockResolvedValue({
      id: "doc1",
      type: "pdf",
      title: "My PDF",
    } as never);
    vi.mocked(getPdfMeta).mockResolvedValue({
      id: "meta1",
      document_id: "doc1",
      storage_key: "pdfs/doc1.pdf",
      file_size: 1024,
      page_count: null,
    } as never);

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    vi.mocked(mockR2.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(pdfBytes);
          controller.close();
        },
      }),
    });

    const req = createRequest("GET", "/api/documents/doc1/content");
    const res = await GET(req, routeParams("doc1"));

    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("My PDF.pdf");
  });

  it("returns 404 for nonexistent document", async () => {
    vi.mocked(getDocumentDetail).mockResolvedValue(null as never);

    const req = createRequest("GET", "/api/documents/missing/content");
    const res = await GET(req, routeParams("missing"));

    expect(res.status).toBe(404);
  });

  it("returns 404 when PDF metadata not found", async () => {
    vi.mocked(getDocumentDetail).mockResolvedValue({
      id: "doc1",
      type: "pdf",
      title: "My PDF",
    } as never);
    vi.mocked(getPdfMeta).mockResolvedValue(null as never);

    const req = createRequest("GET", "/api/documents/doc1/content");
    const res = await GET(req, routeParams("doc1"));

    expect(res.status).toBe(404);
  });
});
