import { NextRequest } from "next/server";
import { completeUserOnboarding, InvalidSlugError, SlugTakenError } from "@focus-reader/api";
import { getUserById } from "@focus-reader/db";
import { scopeDb } from "@focus-reader/db";
import type { User } from "@focus-reader/shared";
import { getDb, getEnv } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { resolveAuthUser } from "@/lib/auth-middleware";

function toAuthPayload(input: {
  authMode: "single-user" | "multi-user";
  method?: "session" | "cf-access" | "api-key" | "single-user";
  user: User;
}) {
  const needsOnboarding =
    input.authMode === "multi-user" &&
    input.user.onboarding_completed_at == null;

  return {
    authenticated: true,
    authMode: input.authMode,
    method: input.method,
    needsOnboarding,
    user: {
      id: input.user.id,
      email: input.user.email,
      slug: input.user.slug,
      name: input.user.name,
      avatar_url: input.user.avatar_url,
      onboarding_completed_at: input.user.onboarding_completed_at,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    const authMode = env.AUTH_MODE === "multi-user" ? "multi-user" : "single-user";

    const result = await resolveAuthUser(request);
    if (!result.authenticated || !result.userId) {
      return json({ authenticated: false, authMode, needsOnboarding: false });
    }

    const db = await getDb();
    const user = await getUserById(db, result.userId);
    if (!user) {
      return json({ authenticated: false, authMode, needsOnboarding: false });
    }

    return json(toAuthPayload({ authMode, method: result.method, user }));
  } catch (error) {
    console.error("[auth/me]", error);
    return jsonError("Failed to resolve auth session", "AUTH_ME_ERROR", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const env = await getEnv();
    const authMode = env.AUTH_MODE === "multi-user" ? "multi-user" : "single-user";
    if (authMode !== "multi-user") {
      return jsonError("Profile updates are only available in multi-user mode", "UNSUPPORTED_MODE", 400);
    }

    const result = await resolveAuthUser(request);
    if (!result.authenticated || !result.userId) {
      return jsonError("Authentication required", "UNAUTHORIZED", 401);
    }

    const body = (await request.json().catch(() => ({}))) as { slug?: unknown };
    const slugInput = typeof body.slug === "string" ? body.slug : "";

    const db = await getDb();
    const ctx = scopeDb(db, result.userId);
    const user = await completeUserOnboarding(ctx, slugInput);

    return json(toAuthPayload({ authMode, method: result.method, user }));
  } catch (error) {
    if (error instanceof InvalidSlugError) {
      return jsonError(error.message, "INVALID_SLUG", 400);
    }
    if (error instanceof SlugTakenError) {
      return jsonError(error.message, "SLUG_TAKEN", 409);
    }

    console.error("[auth/me][PATCH]", error);
    return jsonError("Failed to update profile", "UPDATE_ERROR", 500);
  }
}
