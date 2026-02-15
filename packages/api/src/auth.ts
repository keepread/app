/**
 * Authentication module for Focus Reader.
 *
 * Supports two auth methods:
 * 1. Cloudflare Access JWT — for browser sessions (cookie: CF_Authorization)
 * 2. API key — for programmatic access (header: Authorization: Bearer <key>)
 */

export interface AuthResult {
  authenticated: boolean;
  method?: "cf-access" | "api-key";
  error?: string;
}

/** Decode a base64url string (JWT segments use base64url, not standard base64). */
function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

/**
 * Validate a Cloudflare Access JWT.
 *
 * CF Access sets a cookie `CF_Authorization` containing a signed JWT.
 * We verify the JWT signature against CF's public keys and check the
 * email claim matches the configured owner.
 *
 * In production, CF Access sits in front of the app and rejects
 * unauthenticated requests before they reach the worker. This function
 * provides defense-in-depth by validating the JWT again server-side.
 */
export async function validateCfAccessJwt(
  jwt: string,
  teamDomain: string,
  audience: string
): Promise<{ valid: boolean; email?: string }> {
  try {
    // Fetch CF Access public keys
    const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
    const certsRes = await fetch(certsUrl);
    if (!certsRes.ok) {
      return { valid: false };
    }
    const { keys } = (await certsRes.json()) as { keys: JsonWebKey[] };

    // Try each key until one verifies
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

    // Convert base64url to ArrayBuffer
    const sigBinary = base64urlDecode(signatureB64);
    const signature = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      signature[i] = sigBinary.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
    if (!valid) return { valid: false };

    // Decode and validate payload
    const payload = JSON.parse(base64urlDecode(payloadB64)) as {
      aud?: string[];
      email?: string;
      exp?: number;
      iss?: string;
    };

    // Check audience
    if (!payload.aud?.includes(audience)) {
      return { valid: false };
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }

    return { valid: true, email: payload.email };
  } catch {
    return { valid: false };
  }
}

/**
 * Validate an API key against the database.
 *
 * API keys are stored as SHA-256 hashes. We hash the provided key
 * and look it up in the api_key table.
 */
export async function validateApiKey(
  db: D1Database,
  bearerToken: string
): Promise<boolean> {
  // Hash the token
  const encoder = new TextEncoder();
  const data = encoder.encode(bearerToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const result = await db
    .prepare(
      "SELECT id FROM api_key WHERE key_hash = ? AND revoked_at IS NULL"
    )
    .bind(keyHash)
    .first<{ id: string }>();

  if (result) {
    // Update last_used_at
    await db
      .prepare("UPDATE api_key SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .bind(result.id)
      .run();
    return true;
  }

  return false;
}

/**
 * Unified auth check: try CF Access cookie first, then API key header.
 */
export async function authenticateRequest(
  db: D1Database,
  request: Request,
  env: {
    OWNER_EMAIL?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
  }
): Promise<AuthResult> {
  // 1. Try Cloudflare Access JWT from cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const cfAuthMatch = cookieHeader.match(/CF_Authorization=([^;]+)/);
  if (cfAuthMatch && env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
    const jwt = cfAuthMatch[1];
    const result = await validateCfAccessJwt(
      jwt,
      env.CF_ACCESS_TEAM_DOMAIN,
      env.CF_ACCESS_AUD
    );
    if (result.valid) {
      // Optionally check email matches owner
      if (env.OWNER_EMAIL && result.email !== env.OWNER_EMAIL) {
        return {
          authenticated: false,
          error: "Email does not match owner",
        };
      }
      return { authenticated: true, method: "cf-access" };
    }
  }

  // 2. Try API key from Authorization header
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const valid = await validateApiKey(db, token);
    if (valid) {
      return { authenticated: true, method: "api-key" };
    }
    return {
      authenticated: false,
      error: "Invalid API key",
    };
  }

  // 3. If CF Access env vars not configured, allow through (dev mode / single-user)
  if (!env.CF_ACCESS_TEAM_DOMAIN && !env.CF_ACCESS_AUD) {
    return { authenticated: true, method: "cf-access" };
  }

  return {
    authenticated: false,
    error: "Authentication required",
  };
}
