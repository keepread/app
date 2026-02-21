/**
 * Shared test setup for web API route tests.
 *
 * Mocks the @/lib/bindings module so routes run in plain Node.js
 * without Cloudflare bindings. Auth defaults to dev mode passthrough
 * (no CF_ACCESS vars set).
 */
import { vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock D1Database
// ---------------------------------------------------------------------------
// Default mock user returned by unbounded .prepare().first() calls
// (used by getOrCreateSingleUser in single-user auth mode)
const mockUserRow = {
  id: "test-user-id",
  email: "owner@localhost",
  slug: "owner",
  onboarding_completed_at: null,
};

export function createMockDb(): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
      first: vi.fn().mockResolvedValue(mockUserRow),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0 }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  } as unknown as D1Database;
}

// ---------------------------------------------------------------------------
// Mock R2Bucket
// ---------------------------------------------------------------------------
export function createMockR2(): R2Bucket {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [] }),
    head: vi.fn().mockResolvedValue(null),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

// ---------------------------------------------------------------------------
// Shared mock instances
// ---------------------------------------------------------------------------
export const mockDb = createMockDb();
export const mockR2 = createMockR2();
export const mockUserId = "test-user-id";

// Auth env — no CF_ACCESS vars by default (dev mode passthrough)
let envOverrides: Record<string, string | undefined> = {};

export function setAuthEnabled(enabled: boolean) {
  if (enabled) {
    envOverrides = {
      CF_ACCESS_TEAM_DOMAIN: "test-team",
      CF_ACCESS_AUD: "test-aud",
    };
  } else {
    envOverrides = {};
  }
}

export function setEnvOverrides(overrides: Record<string, string | undefined>) {
  envOverrides = overrides;
}

// ---------------------------------------------------------------------------
// Mock @/lib/bindings
// ---------------------------------------------------------------------------
vi.mock("@/lib/bindings", () => ({
  getDb: vi.fn(async () => mockDb),
  getEnv: vi.fn(async () => ({
    FOCUS_DB: mockDb,
    FOCUS_STORAGE: mockR2,
    EMAIL_DOMAIN: "read.example.com",
    AUTH_SECRET: "test-auth-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    ...envOverrides,
  })),
  getR2: vi.fn(async () => mockR2),
  getExtractionQueue: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------
interface CreateRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
}

export function createRequest(
  method: string,
  url: string,
  options?: CreateRequestOptions
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;

  const init: RequestInit = { method };

  if (options?.headers) {
    init.headers = options.headers;
  }

  if (options?.formData) {
    init.body = options.formData;
  } else if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
  }

  return new NextRequest(fullUrl, init as never);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function jsonBody(res: Response): Promise<any> {
  return res.json();
}

/**
 * Create route params object matching Next.js App Router convention:
 * `{ params: Promise<{ id: string }> }`
 */
export function routeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
