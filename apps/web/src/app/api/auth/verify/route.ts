import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/bindings";

function redirectWithError(request: NextRequest, code: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: NextRequest) {
  const env = await getEnv();
  if (env.AUTH_MODE !== "multi-user") {
    return redirectWithError(request, "unsupported_mode");
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return redirectWithError(request, "missing_token");
  }

  const verifyUrl = new URL("/api/auth/magic-link/verify", request.url);
  verifyUrl.searchParams.set("token", token);
  verifyUrl.searchParams.set("callbackURL", "/inbox");
  verifyUrl.searchParams.set("newUserCallbackURL", "/onboarding");
  verifyUrl.searchParams.set("errorCallbackURL", "/login?error=invalid_or_expired");
  return NextResponse.redirect(verifyUrl, { status: 302 });
}
