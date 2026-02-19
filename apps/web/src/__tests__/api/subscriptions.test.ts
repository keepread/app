import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, routeParams, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getSubscriptions: vi.fn(),
  addSubscription: vi.fn(),
  patchSubscription: vi.fn(),
  removeSubscription: vi.fn(),
  tagSubscription: vi.fn(),
  untagSubscription: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, userId: "test-user-id", method: "cf-access" }),
}));

import { GET, POST } from "@/app/api/subscriptions/route";
import { PATCH, DELETE } from "@/app/api/subscriptions/[id]/route";
import { POST as TagPOST, DELETE as TagDELETE } from "@/app/api/subscriptions/[id]/tags/route";
import {
  getSubscriptions,
  addSubscription,
  patchSubscription,
  removeSubscription,
  tagSubscription,
  untagSubscription,
} from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/subscriptions", () => {
  it("returns subscriptions list", async () => {
    const mockSubs = [{ id: "s1", display_name: "Newsletter" }];
    vi.mocked(getSubscriptions).mockResolvedValue(mockSubs as never);

    const req = createRequest("GET", "/api/subscriptions");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/subscriptions", () => {
  it("creates subscription with generated pseudo email", async () => {
    vi.mocked(addSubscription).mockResolvedValue({
      id: "s1",
      display_name: "My Newsletter",
      pseudo_email: "my-newsletter@read.example.com",
    } as never);

    const req = createRequest("POST", "/api/subscriptions", {
      body: { display_name: "My Newsletter" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(addSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      expect.objectContaining({
        display_name: "My Newsletter",
        pseudo_email: "my-newsletter@read.example.com",
      })
    );
  });

  it("returns 400 when display_name missing", async () => {
    const req = createRequest("POST", "/api/subscriptions", { body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.error.code).toBe("MISSING_NAME");
  });
});

describe("PATCH /api/subscriptions/[id]", () => {
  it("updates subscription", async () => {
    vi.mocked(patchSubscription).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/subscriptions/s1", {
      body: { display_name: "Updated" },
    });
    const res = await PATCH(req, routeParams("s1"));

    expect(res.status).toBe(200);
    expect(patchSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDb, userId: "test-user-id" }),
      "s1",
      expect.objectContaining({ display_name: "Updated" })
    );
  });

  it("handles addTagId", async () => {
    vi.mocked(tagSubscription).mockResolvedValue(undefined as never);

    const req = createRequest("PATCH", "/api/subscriptions/s1", {
      body: { addTagId: "tag1" },
    });
    const res = await PATCH(req, routeParams("s1"));

    expect(res.status).toBe(200);
    expect(tagSubscription).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "s1", "tag1");
  });
});

describe("DELETE /api/subscriptions/[id]", () => {
  it("removes subscription", async () => {
    vi.mocked(removeSubscription).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/subscriptions/s1");
    const res = await DELETE(req, routeParams("s1"));

    expect(res.status).toBe(200);
    expect(removeSubscription).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "s1", false);
  });
});

describe("POST /api/subscriptions/[id]/tags", () => {
  it("adds tag to subscription", async () => {
    vi.mocked(tagSubscription).mockResolvedValue(undefined as never);

    const req = createRequest("POST", "/api/subscriptions/s1/tags", {
      body: { tagId: "tag1" },
    });
    const res = await TagPOST(req, routeParams("s1"));

    expect(res.status).toBe(200);
    expect(tagSubscription).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "s1", "tag1");
  });

  it("returns 400 when tagId missing", async () => {
    const req = createRequest("POST", "/api/subscriptions/s1/tags", { body: {} });
    const res = await TagPOST(req, routeParams("s1"));

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/subscriptions/[id]/tags", () => {
  it("removes tag from subscription", async () => {
    vi.mocked(untagSubscription).mockResolvedValue(undefined as never);

    const req = createRequest("DELETE", "/api/subscriptions/s1/tags", {
      body: { tagId: "tag1" },
    });
    const res = await TagDELETE(req, routeParams("s1"));

    expect(res.status).toBe(200);
    expect(untagSubscription).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb, userId: "test-user-id" }), "s1", "tag1");
  });
});
