import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, mockDb, setAuthEnabled } from "../setup";

vi.mock("@focus-reader/api", () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  authenticateRequest: vi.fn().mockResolvedValue({ authenticated: true, method: "cf-access" }),
}));

import { GET, PATCH } from "@/app/api/preferences/route";
import { getPreferences, updatePreferences } from "@focus-reader/api";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthEnabled(false);
});

describe("GET /api/preferences", () => {
  it("returns user preferences", async () => {
    vi.mocked(getPreferences).mockResolvedValue({
      id: "default",
      schema_version: 1,
      theme: "system",
      font_family: "serif",
      font_size: 20,
      line_height: 1.6,
      content_width: 680,
      shortcut_map_json: null,
      view_mode_prefs_json: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const req = createRequest("GET", "/api/preferences");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.font_family).toBe("serif");
    expect(body.font_size).toBe(20);
  });
});

describe("PATCH /api/preferences", () => {
  it("updates preferences", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({
      id: "default",
      schema_version: 1,
      theme: "system",
      font_family: "mono",
      font_size: 22,
      line_height: 1.8,
      content_width: 700,
      shortcut_map_json: null,
      view_mode_prefs_json: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const req = createRequest("PATCH", "/api/preferences", {
      body: { font_family: "mono", font_size: 22 },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(updatePreferences).toHaveBeenCalledWith(mockDb, {
      font_family: "mono",
      font_size: 22,
    });
  });
});
