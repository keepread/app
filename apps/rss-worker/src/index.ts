import {
  normalizeUrl,
  countWords,
  estimateReadingTime,
  generateExcerpt,
  MAX_RETRY_ATTEMPTS,
} from "@focus-reader/shared";
import type { Feed } from "@focus-reader/shared";
import {
  getFeedsDueForPoll,
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
} from "@focus-reader/parser";
import type { FeedItem } from "@focus-reader/parser";

export interface Env {
  FOCUS_DB: D1Database;
}

const MAX_FEEDS_PER_RUN = 20;
const MAX_CONSECUTIVE_ERRORS = 5;

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
  db: D1Database,
  feed: Feed,
  item: FeedItem
): Promise<boolean> {
  if (!item.url) return false;

  const normalized = normalizeUrl(item.url);
  const existing = await getDocumentByUrl(db, normalized);
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

    if (feed.fetch_full_content === 1) {
      try {
        const article = await withRetry(MAX_RETRY_ATTEMPTS, async () => {
          const resp = await fetch(item.url, {
            headers: { "User-Agent": "FocusReader/1.0" },
            redirect: "follow",
          });
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          const html = await resp.text();
          return extractArticle(html, item.url);
        });

        if (article.title && article.htmlContent) {
          title = article.title;
          author = article.author || author;
          htmlContent = article.htmlContent;
          markdownContent = article.markdownContent;
          wordCount = article.wordCount;
          readingTime = article.readingTimeMinutes;
          excerpt = article.excerpt || excerpt;
          siteName = article.siteName || siteName;
        }
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

    await createDocument(db, {
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
      origin_type: "feed",
      source_id: feed.id,
      published_at: item.publishedAt,
      location: "inbox",
    });

    // Inherit feed tags
    const feedTags = await getTagsForFeed(db, feed.id);
    for (const tag of feedTags) {
      await addTagToDocument(db, documentId, tag.id);
    }

    await logIngestionEvent(db, {
      event_id: eventId,
      document_id: documentId,
      channel_type: "rss",
      status: "success",
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logIngestionEvent(db, {
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

async function processFeed(db: D1Database, feed: Feed): Promise<void> {
  const parsedFeed = await fetchFeed(feed.feed_url);

  for (const item of parsedFeed.items) {
    await processItem(db, feed, item);
  }

  await markFeedFetched(db, feed.id);
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const db = env.FOCUS_DB;
    const feeds = await getFeedsDueForPoll(db);
    const batch = feeds.slice(0, MAX_FEEDS_PER_RUN);

    const results = await Promise.allSettled(
      batch.map(async (feed) => {
        try {
          await processFeed(db, feed);
          return { feedId: feed.id, success: true };
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          await incrementFeedError(db, feed.id, errorMessage);

          // Re-fetch feed to check error_count
          const updated = await getFeed(db, feed.id);
          if (updated && updated.error_count >= MAX_CONSECUTIVE_ERRORS) {
            await updateFeed(db, feed.id, { is_active: 0 });
          }

          // Log failure ingestion event
          await logIngestionEvent(db, {
            event_id: crypto.randomUUID(),
            channel_type: "rss",
            status: "failure",
            error_code: "FEED_FETCH_ERROR",
            error_detail: errorMessage,
          }).catch(() => {});

          return { feedId: feed.id, success: false };
        }
      })
    );

    const processed = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const errors = results.length - processed;
    console.log(
      `RSS poll complete: ${processed} feeds processed, ${errors} errors`
    );
  },
} satisfies ExportedHandler<Env>;
