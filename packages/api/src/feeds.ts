import type {
  Feed,
  FeedWithStats,
  UpdateFeedInput,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  listFeeds,
  createFeed,
  getFeedByUrl,
  getFeedByUrlIncludeDeleted,
  restoreFeed,
  updateFeed,
  softDeleteFeed,
  hardDeleteFeed,
  addTagToFeed,
  removeTagFromFeed,
} from "@focus-reader/db";
import {
  fetchFeed,
  discoverFeedUrl,
  parseOpml,
  generateOpml,
} from "@focus-reader/parser";
import type { OpmlFeed } from "@focus-reader/parser";

export async function getFeeds(ctx: UserScopedDb): Promise<FeedWithStats[]> {
  return listFeeds(ctx);
}

export async function addFeed(ctx: UserScopedDb, url: string): Promise<Feed> {
  // Check for duplicate before any network fetch (idempotent for known URLs)
  const existingDirect = await getFeedByUrl(ctx, url);
  if (existingDirect) {
    throw new DuplicateFeedError(existingDirect.id);
  }

  // Check if soft-deleted — restore instead of creating new
  const deletedDirect = await getFeedByUrlIncludeDeleted(ctx, url);
  if (deletedDirect && deletedDirect.deleted_at) {
    return restoreFeed(ctx, deletedDirect.id);
  }

  let feedUrl = url;
  let parsedFeed;

  // Try fetching the URL directly as a feed
  try {
    parsedFeed = await fetchFeed(url);
  } catch {
    // Not a feed URL — try discovering from HTML
    const response = await fetch(url, {
      headers: { "User-Agent": "FocusReader/1.0" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }
    const html = await response.text();
    const discovered = discoverFeedUrl(html, url);
    if (!discovered) {
      throw new Error("No feed found at this URL");
    }
    feedUrl = discovered;

    // Check duplicate for discovered URL before second fetch
    const existingDiscovered = await getFeedByUrl(ctx, feedUrl);
    if (existingDiscovered) {
      throw new DuplicateFeedError(existingDiscovered.id);
    }

    // Check soft-deleted for discovered URL
    const deletedDiscovered = await getFeedByUrlIncludeDeleted(ctx, feedUrl);
    if (deletedDiscovered && deletedDiscovered.deleted_at) {
      return restoreFeed(ctx, deletedDiscovered.id);
    }

    parsedFeed = await fetchFeed(feedUrl);
  }

  // Final duplicate check (feedUrl may differ from input url for direct feeds
  // if the input URL was not already in DB but resolved to a known feed_url)
  if (feedUrl !== url) {
    const existingFinal = await getFeedByUrl(ctx, feedUrl);
    if (existingFinal) {
      throw new DuplicateFeedError(existingFinal.id);
    }

    // Check soft-deleted for final resolved URL
    const deletedFinal = await getFeedByUrlIncludeDeleted(ctx, feedUrl);
    if (deletedFinal && deletedFinal.deleted_at) {
      return restoreFeed(ctx, deletedFinal.id);
    }
  }

  return createFeed(ctx, {
    feed_url: feedUrl,
    title: parsedFeed.title || feedUrl,
    description: parsedFeed.description,
    site_url: parsedFeed.siteUrl,
    icon_url: parsedFeed.iconUrl,
  });
}

export async function patchFeed(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateFeedInput
): Promise<void> {
  await updateFeed(ctx, id, updates);
}

export async function removeFeed(
  ctx: UserScopedDb,
  id: string,
  hard = false
): Promise<void> {
  if (hard) {
    await hardDeleteFeed(ctx, id);
  } else {
    await softDeleteFeed(ctx, id);
  }
}

export async function importOpml(
  ctx: UserScopedDb,
  xml: string
): Promise<{ imported: number; skipped: number }> {
  const feeds = parseOpml(xml);
  let imported = 0;
  let skipped = 0;

  for (const feed of feeds) {
    // Skip active duplicates
    const existing = await getFeedByUrl(ctx, feed.feedUrl);
    if (existing) {
      skipped++;
      continue;
    }

    // Restore soft-deleted feeds
    const deleted = await getFeedByUrlIncludeDeleted(ctx, feed.feedUrl);
    if (deleted && deleted.deleted_at) {
      await restoreFeed(ctx, deleted.id);
      imported++;
      continue;
    }

    await createFeed(ctx, {
      feed_url: feed.feedUrl,
      title: feed.title || feed.feedUrl,
      site_url: feed.siteUrl,
    });
    imported++;
  }

  return { imported, skipped };
}

export async function exportOpml(ctx: UserScopedDb): Promise<string> {
  const feeds = await listFeeds(ctx);
  const opmlFeeds: OpmlFeed[] = feeds.map((f) => ({
    title: f.title,
    feedUrl: f.feed_url,
    siteUrl: f.site_url,
  }));
  return generateOpml(opmlFeeds, "Focus Reader Feeds");
}

export async function tagFeed(
  ctx: UserScopedDb,
  feedId: string,
  tagId: string
): Promise<void> {
  await addTagToFeed(ctx, feedId, tagId);
}

export async function untagFeed(
  ctx: UserScopedDb,
  feedId: string,
  tagId: string
): Promise<void> {
  await removeTagFromFeed(ctx, feedId, tagId);
}

export class DuplicateFeedError extends Error {
  public existingId: string;
  constructor(existingId: string) {
    super("This feed is already subscribed");
    this.name = "DuplicateFeedError";
    this.existingId = existingId;
  }
}
