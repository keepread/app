import { NextRequest } from "next/server";
import { getEnv } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const env = await getEnv();
      return json({
        emailDomain: env.EMAIL_DOMAIN || null,
      });
    } catch {
      return jsonError("Failed to fetch settings", "FETCH_ERROR", 500);
    }
  });
}
