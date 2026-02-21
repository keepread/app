import { getUserById } from "@focus-reader/db";
import { getDb, getEnv } from "./bindings";
import { resolveAuthUser } from "./auth-middleware";

export interface ServerAuthState {
  authMode: "single-user" | "multi-user";
  authenticated: boolean;
  userId?: string;
  needsOnboarding: boolean;
  user?: {
    id: string;
    slug: string;
    onboardingCompletedAt: string | null;
  };
}

export async function resolveServerAuthState(
  requestHeaders: Headers
): Promise<ServerAuthState> {
  const env = await getEnv();
  const authMode = env.AUTH_MODE === "multi-user" ? "multi-user" : "single-user";
  // resolveAuthUser expects a Request object but only reads its headers.
  // We construct a synthetic one here so server components can call it
  // without an actual incoming request handle.
  const request = new Request("http://localhost", {
    headers: requestHeaders,
  });

  const authResult = await resolveAuthUser(request);
  if (!authResult.authenticated || !authResult.userId) {
    return {
      authMode,
      authenticated: false,
      needsOnboarding: false,
    };
  }

  const db = await getDb();
  const user = await getUserById(db, authResult.userId);
  if (!user) {
    return {
      authMode,
      authenticated: false,
      needsOnboarding: false,
    };
  }

  const needsOnboarding =
    authMode === "multi-user" && user.onboarding_completed_at == null;

  return {
    authMode,
    authenticated: true,
    userId: user.id,
    needsOnboarding,
    user: {
      id: user.id,
      slug: user.slug,
      onboardingCompletedAt: user.onboarding_completed_at,
    },
  };
}
