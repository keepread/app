import { authenticateRequest } from "@focus-reader/api";
import { getDb, getEnv } from "./bindings";
import { jsonError } from "./api-helpers";

export async function withAuth(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const db = await getDb();
  const env = await getEnv();
  const result = await authenticateRequest(db, request, {
    OWNER_EMAIL: env.OWNER_EMAIL,
    CF_ACCESS_TEAM_DOMAIN: env.CF_ACCESS_TEAM_DOMAIN,
    CF_ACCESS_AUD: env.CF_ACCESS_AUD,
  });
  if (!result.authenticated) {
    return jsonError(
      result.error || "Authentication required",
      "UNAUTHORIZED",
      401
    );
  }
  return handler();
}
