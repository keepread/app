import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  listApiKeys: vi.fn(),
  generateApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, POST } from "@/app/api/api-keys/route";
import { DELETE } from "@/app/api/api-keys/[id]/route";
import { listApiKeys, generateApiKey, revokeApiKey } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/api-keys", () => {
  it("returns API keys without key_hash", async () => {
    const mockKeys = [
      {
        id: "k1",
        key_prefix: "fr_abc",
        key_hash: "secret_hash",
        label: "Test Key",
        last_used_at: null,
        created_at: "2024-01-01",
        revoked_at: null,
      },
    ];
    vi.mocked(listApiKeys).mockResolvedValue(mockKeys as never);

    const req = createRequest("GET", "/api/api-keys");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
    expect(body[0].key_prefix).toBe("fr_abc");
    expect(body[0]).not.toHaveProperty("key_hash");
  });
});

describe("POST /api/api-keys", () => {
  it("creates key and returns plaintext once", async () => {
    vi.mocked(generateApiKey).mockResolvedValue({
      key: "fr_plaintext_key_12345",
      record: {
        id: "k1",
        key_prefix: "fr_pla",
        key_hash: "hash",
        label: "My Key",
        last_used_at: null,
        created_at: "2024-01-01",
        revoked_at: null,
      },
    } as never);

    const req = createRequest("POST", "/api/api-keys", {
      body: { label: "My Key" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, any>;
    expect(body.key).toBe("fr_plaintext_key_12345");
    expect(body.record.label).toBe("My Key");
    expect(body.record).not.toHaveProperty("key_hash");
  });

  it("returns 400 when label missing", async () => {
    const req = createRequest("POST", "/api/api-keys", { body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_LABEL");
  });

  it("returns 400 when label is only whitespace", async () => {
    const req = createRequest("POST", "/api/api-keys", { body: { label: "   " } });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/api-keys/[id]", () => {
  it("revokes key", async () => {
    vi.mocked(revokeApiKey).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/api-keys/k1");
    const res = await DELETE(req, routeParams("k1"));

    expect(res.status).toBe(200);
    expect(revokeApiKey).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "k1");
  });
});
