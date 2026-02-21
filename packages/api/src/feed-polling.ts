import {
  normalizeUrl,
  countWords,
  estimateReadingTime,
  generateExcerpt,
  MAX_RETRY_ATTEMPTS,
  evaluateAutoTagRules,
} from "@focus-reader/shared";
import type { Feed, AutoTagRule } from "@focus-reader/shared";
import { scoreExtraction, shouldEnrich } from "./extraction-quality.js";
import type { EnrichmentIntent } from "./extraction-quality.js";
import type { UserScopedDb } from "@focus-reader/db";
import {
  getAllFeedsDueForPoll,
  scopeDb,
} from "@focus-reader/db";
import {
  markFeedFetched,
  incrementFeedError,
  updateFeed,
  getFeed,
  createDocument,
  getDocumentByUrl,
  getTagsForFeed,
  addTagToDocument,
  logIngestionEvent,
} from "@focus-reader/db";
import {
  fetchFeed,
  sanitizeHtml,
  htmlToMarkdown,
  extractArticle,
  extractMetadata,
} from "@focus-reader/parser";
import type { FeedItem } from "@focus-reader/parser";

const MAX_FEEDS_PER_RUN = 20;
const MAX_CONSECUTIVE_ERRORS = 5;

export interface PollResult {
  feedId: string;
  success: boolean;
  newItems: number;
  error?: string;
}

async function withRetry<T>(
  maxAttempts: number,
  fn: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        // Exponential backoff: 100ms, 400ms, 900ms
        const delay = attempt * attempt * 100;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function processItem(
  ctx: UserScopedDb,
  feed: Feed,
  item: FeedItem,
  onLowQuality?: (intent: EnrichmentIntent) => void | Promise<void>
): Promise<boolean> {
  if (!item.url) return false;

  const normalized = normalizeUrl(item.url);
  const existing = await getDocumentByUrl(ctx, normalized);
  if (existing) return false;

  const eventId = crypto.randomUUID();
  const documentId = crypto.randomUUID();

  try {
    let title = item.title || "";
    let author = item.author;
    let htmlContent: string | null = null;
    let markdownContent: string | null = null;
    let plainText: string | null = null;
    let wordCount = 0;
    let readingTime = 1;
    let excerpt = item.excerpt;
    let siteName = feed.title || null;
    let coverImageUrl = item.coverImageUrl;
    let lang: string | null = null;

    if (feed.fetch_full_content === 1) {
      try {
        const result = await withRetry(MAX_RETRY_ATTEMPTS, async () => {
          const resp = await fetch(item.url, {
            headers: { "User-Agent": "FocusReader/1.0" },
            redirect: "follow",
          });
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          const html = await resp.text();
          return { article: extractArticle(html, item.url), html };
        });

        if (result.article.title && result.article.htmlContent) {
          title = result.article.title;
          author = result.article.author || author;
          htmlContent = result.article.htmlContent;
          markdownContent = result.article.markdownContent;
          wordCount = result.article.wordCount;
          readingTime = result.article.readingTimeMinutes;
          excerpt = result.article.excerpt || excerpt;
          siteName = result.article.siteName || siteName;
        }

        // Supplement with metadata extraction
        const meta = extractMetadata(result.html, item.url);
        coverImageUrl = coverImageUrl || meta.ogImage;
        lang = meta.lang;
      } catch {
        // Fall through to default path
      }
    }

    // Default path: use feed item content if full-content extraction didn't succeed
    if (!htmlContent && item.contentHtml) {
      htmlContent = sanitizeHtml(item.contentHtml);
      markdownContent = htmlToMarkdown(htmlContent);
      plainText = markdownContent.replace(/[#*_`\[\]()>~-]/g, "").trim();
      wordCount = countWords(plainText);
      readingTime = estimateReadingTime(wordCount);
    } else if (!htmlContent && item.contentText) {
      // Text-only items (common in JSON Feed)
      plainText = item.contentText;
      markdownContent = plainText;
      htmlContent = `<p>${sanitizeHtml(plainText.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>"))}</p>`;
      wordCount = countWords(plainText);
      readingTime = estimateReadingTime(wordCount);
    }

    if (!excerpt && plainText) {
      excerpt = generateExcerpt(plainText);
    }

    await createDocument(ctx, {
      id: documentId,
      type: "rss",
      url: normalized,
      title: title || "(Untitled)",
      author,
      excerpt,
      site_name: siteName,
      html_content: htmlContent,
      markdown_content: markdownContent,
      plain_text_content: plainText,
      word_count: wordCount,
      reading_time_minutes: readingTime,
      cover_image_url: coverImageUrl,
      lang,
      origin_type: "feed",
      source_id: feed.id,
      published_at: item.publishedAt,
      location: "inbox",
    });

    // Check extraction quality for enrichment
    if (onLowQuality && feed.fetch_full_content === 1) {
      const score = scoreExtraction({
        title: title || null,
        url: normalized,
        htmlContent,
        plainTextContent: plainText,
        author: author || null,
        siteName,
        publishedDate: item.publishedAt || null,
        coverImageUrl: coverImageUrl || null,
        excerpt: excerpt || null,
        wordCount,
      });
      if (shouldEnrich(score, { hasUrl: true })) {
        onLowQuality({
          documentId,
          userId: ctx.userId,
          url: normalized,
          source: "rss_full_content",
          score,
        });
      }
    }

    // Evaluate feed auto-tag rules
    if (feed.auto_tag_rules) {
      const rules: AutoTagRule[] = JSON.parse(feed.auto_tag_rules);
      const matchedTagIds = evaluateAutoTagRules(rules, {
        title: title || "(Untitled)",
        author: author || null,
        url: normalized,
        plain_text_content: plainText,
      });
      for (const tagId of matchedTagIds) {
        await addTagToDocument(ctx, documentId, tagId);
      }
    }

    // Inherit feed tags
    const feedTags = await getTagsForFeed(ctx, feed.id);
    for (const tag of feedTags) {
      await addTagToDocument(ctx, documentId, tag.id);
    }

    await logIngestionEvent(ctx, {
      event_id: eventId,
      document_id: documentId,
      channel_type: "rss",
      status: "success",
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logIngestionEvent(ctx, {
      event_id: eventId,
      document_id: documentId,
      channel_type: "rss",
      status: "failure",
      error_code: "ITEM_PROCESSING_ERROR",
      error_detail: errorMessage,
    }).catch(() => {});
    console.warn(
      `Failed to process item ${item.url} from feed ${feed.id}: ${errorMessage}`
    );
    return false;
  }
}

async function processFeed(
  ctx: UserScopedDb,
  feed: Feed,
  onLowQuality?: (intent: EnrichmentIntent) => void | Promise<void>
): Promise<number> {
  const parsedFeed = await fetchFeed(feed.feed_url);
  let newItems = 0;

  for (const item of parsedFeed.items) {
    const created = await processItem(ctx, feed, item, onLowQuality);
    if (created) newItems++;
  }

  await markFeedFetched(ctx, feed.id);
  return newItems;
}

export async function pollSingleFeed(
  ctx: UserScopedDb,
  feedId: string,
  onLowQuality?: (intent: EnrichmentIntent) => void | Promise<void>
): Promise<PollResult> {
  const feed = await getFeed(ctx, feedId);
  if (!feed) {
    return { feedId, success: false, newItems: 0, error: "Feed not found" };
  }

  try {
    const newItems = await processFeed(ctx, feed, onLowQuality);
    return { feedId, success: true, newItems };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await incrementFeedError(ctx, feedId, errorMessage);

    // Re-fetch feed to check error_count
    const updated = await getFeed(ctx, feedId);
    if (updated && updated.error_count >= MAX_CONSECUTIVE_ERRORS) {
      await updateFeed(ctx, feedId, { is_active: 0 });
    }

    // Log failure ingestion event
    await logIngestionEvent(ctx, {
      event_id: crypto.randomUUID(),
      channel_type: "rss",
      status: "failure",
      error_code: "FEED_FETCH_ERROR",
      error_detail: errorMessage,
    }).catch(() => {});

    return { feedId, success: false, newItems: 0, error: errorMessage };
  }
}

export async function pollDueFeeds(
  db: D1Database,
  maxFeeds = MAX_FEEDS_PER_RUN,
  onLowQuality?: (intent: EnrichmentIntent) => void | Promise<void>
): Promise<PollResult[]> {
  // Use admin query to get all feeds due for poll across all users
  const feeds = await getAllFeedsDueForPoll(db);
  const batch = feeds.slice(0, maxFeeds);

  const results = await Promise.allSettled(
    batch.map((feed) => {
      // Create a user-scoped context for each feed's owner
      const ctx = scopeDb(db, feed.user_id);
      return pollSingleFeed(ctx, feed.id, onLowQuality);
    })
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { feedId: "unknown", success: false, newItems: 0, error: String(r.reason) }
  );
}
