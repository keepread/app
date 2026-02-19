/**
 * Authentication module for Focus Reader.
 *
 * Supports auth methods:
 * 1. Cloudflare Access JWT — for browser sessions (cookie: CF_Authorization)
 * 2. API key — for programmatic access (header: Authorization: Bearer <key>)
 * 3. Single-user auto-auth — only when CF Access is NOT configured
 *
 * If CF Access env vars are set, they are enforced — no auto-auth fallback.
 * Auto-auth only applies when CF Access is not configured (local dev, simple deploys).
 */
import {
  getUserByEmail,
  getOrCreateSingleUser,
  createUserByEmail,
  getApiKeyByHashAdmin as adminGetApiKeyByHash,
} from "@focus-reader/db";

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  method?: "cf-access" | "api-key" | "single-user";
  error?: string;
}

/** Decode a base64url string (JWT segments use base64url, not standard base64). */
function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

/**
 * Validate a Cloudflare Access JWT.
 */
export async function validateCfAccessJwt(
  jwt: string,
  teamDomain: string,
  audience: string
): Promise<{ valid: boolean; email?: string }> {
  try {
    const normalizedDomain = teamDomain.includes(".cloudflareaccess.com")
      ? teamDomain
      : `${teamDomain}.cloudflareaccess.com`;
    const certsUrl = `https://${normalizedDomain}/cdn-cgi/access/certs`;
    const certsRes = await fetch(certsUrl);
    if (!certsRes.ok) {
      return { valid: false };
    }
    const { keys } = (await certsRes.json()) as { keys: JsonWebKey[] };

    const [headerB64, payloadB64] = jwt.split(".");
    if (!headerB64 || !payloadB64) return { valid: false };

    const header = JSON.parse(base64urlDecode(headerB64)) as { kid?: string; alg: string };
    const matchingKey = keys.find((k) => (k as unknown as Record<string, unknown>).kid === header.kid);
    if (!matchingKey) return { valid: false };

    const key = await crypto.subtle.importKey(
      "jwk",
      matchingKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureB64 = jwt.split(".")[2];
    if (!signatureB64) return { valid: false };

    const sigBinary = base64urlDecode(signatureB64);
    const signature = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      signature[i] = sigBinary.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
    if (!valid) return { valid: false };

    const payload = JSON.parse(base64urlDecode(payloadB64)) as {
      aud?: string[];
      email?: string;
      exp?: number;
      iss?: string;
    };

    if (!payload.aud?.includes(audience)) {
      return { valid: false };
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }

    return { valid: true, email: payload.email };
  } catch {
    return { valid: false };
  }
}

/**
 * Validate an API key and return the owning user_id.
 */
export async function validateApiKey(
  db: D1Database,
  bearerToken: string
): Promise<{ valid: boolean; userId?: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(bearerToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const result = await adminGetApiKeyByHash(db, keyHash);
  if (result) {
    return { valid: true, userId: result.user_id };
  }
  return { valid: false };
}

/**
 * Unified auth check: try CF Access cookie, then API key, then single-user auto-auth.
 * Returns userId on success so callers can create a UserScopedDb.
 */
export async function authenticateRequest(
  db: D1Database,
  request: Request,
  env: {
    OWNER_EMAIL?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    AUTH_MODE?: string;
  }
): Promise<AuthResult> {
  const cfAccessConfigured = !!(env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD);

  // 1. Try Cloudflare Access JWT from cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const cfAuthMatch = cookieHeader.match(/CF_Authorization=([^;]+)/);
  if (cfAuthMatch && cfAccessConfigured) {
    const jwt = cfAuthMatch[1];
    const result = await validateCfAccessJwt(
      jwt,
      env.CF_ACCESS_TEAM_DOMAIN!,
      env.CF_ACCESS_AUD!
    );
    if (result.valid && result.email) {
      const user = await getUserByEmail(db, result.email);
      if (user) {
        return { authenticated: true, userId: user.id, method: "cf-access" };
      }
      // User not found — create a new user for this email.
      // In multi-user mode, this means a new independent user.
      // In single-user mode with CF Access, this means the owner
      // added another email to the CF Access policy.
      // Either way, each email gets its own isolated user row.
      const created = await createUserByEmail(db, result.email);
      return { authenticated: true, userId: created.id, method: "cf-access" };
    }
  }

  // 2. Try API key from Authorization header
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await validateApiKey(db, token);
    if (result.valid && result.userId) {
      return { authenticated: true, userId: result.userId, method: "api-key" };
    }
    return { authenticated: false, error: "Invalid API key" };
  }

  // 3. Auto-auth as sole user — only when CF Access is NOT configured.
  // If CF Access is configured, missing/invalid JWT must result in 401.
  if (!cfAccessConfigured) {
    const email = env.OWNER_EMAIL || "owner@localhost";
    const user = await getOrCreateSingleUser(db, email);
    return { authenticated: true, userId: user.id, method: "single-user" };
  }

  return { authenticated: false, error: "Authentication required" };
}
