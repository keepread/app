import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Env {
  FOCUS_DB: D1Database;
  FOCUS_STORAGE: R2Bucket;
  EMAIL_DOMAIN?: string;
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
