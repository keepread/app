import type { ApiKey } from "@focus-reader/shared";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@focus-reader/db";

export { listApiKeys, revokeApiKey };

export async function generateApiKey(
  db: D1Database,
  label: string
): Promise<{ key: string; record: ApiKey }> {
  // Generate 32 random bytes
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  // Hex-encode for the plaintext key
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // SHA-256 hash for storage
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  const key_hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const key_prefix = key.slice(0, 8);

  const record = await createApiKey(db, { key_hash, key_prefix, label });

  return { key, record };
}
