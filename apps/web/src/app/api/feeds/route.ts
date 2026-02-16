import { NextRequest } from "next/server";
import { getFeeds, addFeed, DuplicateFeedError, pollSingleFeed } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const feeds = await getFeeds(db);
      return json(feeds);
    } catch {
      return jsonError("Failed to fetch feeds", "FETCH_ERROR", 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const body = (await request.json()) as Record<string, unknown>;
      const { url } = body as { url?: string };

      if (!url) {
        return jsonError("URL is required", "MISSING_URL", 400);
      }

      const feed = await addFeed(db, url);

      // Fetch articles immediately so the user doesn't wait for the next cron run
      try {
        await pollSingleFeed(db, feed.id);
      } catch {
        // Polling failure shouldn't prevent feed creation
      }

      return json(feed, 201);
    } catch (err) {
      if (err instanceof DuplicateFeedError) {
        return jsonError("This feed is already added", "DUPLICATE_FEED", 409);
      }
      return jsonError("Failed to add feed", "CREATE_ERROR", 500);
    }
  });
}
