import { NextRequest } from "next/server";
import { getSubscriptions, addSubscription } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb, getEnv } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const subscriptions = await getSubscriptions(ctx);
      return json(subscriptions);
    } catch {
      return jsonError("Failed to fetch subscriptions", "FETCH_ERROR", 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const env = await getEnv();
      const body = (await request.json()) as Record<string, unknown>;
      const { display_name } = body as { display_name?: string };

      if (!display_name) {
        return jsonError("Display name is required", "MISSING_NAME", 400);
      }

      // Generate a pseudo email from the display name
      const slug = display_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const domain = env.EMAIL_DOMAIN || "read.example.com";
      const pseudo_email = `${slug}@${domain}`;

      const subscription = await addSubscription(ctx, {
        pseudo_email,
        display_name,
      });
      return json(subscription, 201);
    } catch {
      return jsonError("Failed to create subscription", "CREATE_ERROR", 500);
    }
  });
}
