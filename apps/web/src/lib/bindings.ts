import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ExtractionEnrichmentJob } from "@focus-reader/shared";

interface Env {
  FOCUS_DB: D1Database;
  FOCUS_STORAGE: R2Bucket;
  EMAIL_DOMAIN?: string;
  OWNER_EMAIL?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  AUTH_MODE?: string;
  AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  EXTRACTION_QUEUE?: Queue<ExtractionEnrichmentJob>;
}

export async function getEnv(): Promise<Env> {
  const { env } = await getCloudflareContext();
  return env as unknown as Env;
}

export async function getDb(): Promise<D1Database> {
  const env = await getEnv();
  return env.FOCUS_DB;
}

export async function getR2(): Promise<R2Bucket> {
  const env = await getEnv();
  return env.FOCUS_STORAGE;
}

export async function getExtractionQueue(): Promise<Queue<ExtractionEnrichmentJob> | null> {
  try {
    const env = await getEnv();
    return env.EXTRACTION_QUEUE ?? null;
  } catch {
    return null;
  }
}
