import { NextRequest } from "next/server";
import { getEnv } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { getBetterAuth } from "@/lib/better-auth";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (env.AUTH_MODE !== "multi-user") {
      return jsonError("Magic-link login is only available in multi-user mode", "UNSUPPORTED_MODE", 400);
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return jsonError("A valid email is required", "INVALID_EMAIL", 400);
    }

    const auth = await getBetterAuth();
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: "/inbox",
        newUserCallbackURL: "/onboarding",
        errorCallbackURL: "/login?error=invalid_or_expired",
      },
      headers: request.headers,
    });

    // Generic success response to avoid account enumeration.
    return json({ ok: true, message: "If the email is valid, a sign-in link has been sent." });
  } catch (error) {
    console.error("[auth/login]", error);
    return jsonError("Failed to request sign-in link", "AUTH_LOGIN_ERROR", 500);
  }
}
