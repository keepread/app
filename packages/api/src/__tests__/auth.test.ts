import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateRequest, validateApiKey } from "../auth.js";

function createMockDb(keyResult: { id: string } | null = null) {
  const run = vi.fn().mockResolvedValue({});
  const first = vi.fn().mockResolvedValue(keyResult);
  const bind = vi.fn().mockReturnValue({ first, run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare, bind, first, run } as unknown as D1Database & {
    prepare: ReturnType<typeof vi.fn>;
  };
}

function createRequest(options?: {
  cookie?: string;
  authorization?: string;
}): Request {
  const headers = new Headers();
  if (options?.cookie) headers.set("cookie", options.cookie);
  if (options?.authorization) headers.set("authorization", options.authorization);
  return new Request("https://example.com/api/test", { headers });
}

describe("authenticateRequest", () => {
  describe("dev mode passthrough", () => {
    it("allows requests when CF_ACCESS env vars are not set", async () => {
      const db = createMockDb();
      const request = createRequest();
      const result = await authenticateRequest(db, request, {});

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe("cf-access");
    });

    it("allows requests when CF_ACCESS env vars are empty strings", async () => {
      const db = createMockDb();
      const request = createRequest();
      const result = await authenticateRequest(db, request, {
        CF_ACCESS_TEAM_DOMAIN: "",
        CF_ACCESS_AUD: "",
      });

      expect(result.authenticated).toBe(true);
    });
  });

  describe("API key auth", () => {
    it("authenticates with a valid Bearer token", async () => {
      const db = createMockDb({ id: "key-123" });
      const request = createRequest({
        authorization: "Bearer valid-api-key",
      });
      const result = await authenticateRequest(db, request, {
        CF_ACCESS_TEAM_DOMAIN: "myteam",
        CF_ACCESS_AUD: "aud123",
      });

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe("api-key");
    });

    it("rejects an invalid Bearer token", async () => {
      const db = createMockDb(null); // No matching key
      const request = createRequest({
        authorization: "Bearer invalid-key",
      });
      const result = await authenticateRequest(db, request, {
        CF_ACCESS_TEAM_DOMAIN: "myteam",
        CF_ACCESS_AUD: "aud123",
      });

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });

    it("updates last_used_at on successful API key auth", async () => {
      const db = createMockDb({ id: "key-456" });
      await validateApiKey(db, "some-api-key");

      // Verify the second prepare call was the UPDATE for last_used_at
      expect(db.prepare).toHaveBeenCalledTimes(2);
      const secondCall = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
      expect(secondCall).toContain("UPDATE api_key SET last_used_at");
      expect(secondCall).toContain("strftime");
    });
  });

  describe("unauthenticated requests with CF Access configured", () => {
    it("returns 401 error when no auth is provided and CF Access is configured", async () => {
      const db = createMockDb();
      const request = createRequest(); // No cookie, no authorization header
      const result = await authenticateRequest(db, request, {
        CF_ACCESS_TEAM_DOMAIN: "myteam",
        CF_ACCESS_AUD: "aud123",
      });

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Authentication required");
    });
  });

  describe("CF Access JWT path", () => {
    it("attempts JWT validation when CF_Authorization cookie is present", async () => {
      const db = createMockDb();
      // Use a malformed JWT — it will fail validation, fall through to no-bearer path
      const request = createRequest({
        cookie: "CF_Authorization=not.a.valid-jwt",
      });
      const result = await authenticateRequest(db, request, {
        CF_ACCESS_TEAM_DOMAIN: "myteam",
        CF_ACCESS_AUD: "aud123",
      });

      // JWT is invalid, no bearer token, so should fail
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("skips JWT validation when CF Access env vars are missing", async () => {
      const db = createMockDb();
      const request = createRequest({
        cookie: "CF_Authorization=some.jwt.token",
      });
      // Dev mode: no CF vars → passthrough
      const result = await authenticateRequest(db, request, {});

      expect(result.authenticated).toBe(true);
    });
  });
});
