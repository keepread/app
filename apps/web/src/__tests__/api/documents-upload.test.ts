import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  createPdfDocument: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { POST } from "@/app/api/documents/upload/route";
import { createPdfDocument } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("POST /api/documents/upload", () => {
  it("creates PDF document from file upload", async () => {
    vi.mocked(createPdfDocument).mockResolvedValue({
      id: "doc1",
      title: "test.pdf",
      type: "pdf",
    } as never);

    const formData = new FormData();
    const file = new File(["fake-pdf-content"], "test.pdf", { type: "application/pdf" });
    formData.append("file", file);

    const req = createRequest("POST", "/api/documents/upload", { formData });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, any>;
    expect(body.type).toBe("pdf");
  });

  it("returns 400 when no file provided", async () => {
    const formData = new FormData();

    const req = createRequest("POST", "/api/documents/upload", { formData });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for non-PDF file type", async () => {
    const formData = new FormData();
    const file = new File(["not-a-pdf"], "test.txt", { type: "text/plain" });
    formData.append("file", file);

    const req = createRequest("POST", "/api/documents/upload", { formData });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.message).toContain("PDF");
  });
});
