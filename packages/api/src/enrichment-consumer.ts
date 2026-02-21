import type { ExtractionEnrichmentJob } from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import { getDocument, enrichDocument } from "@focus-reader/db";
import { extractArticle, extractMetadata } from "@focus-reader/parser";
import { scoreExtraction, isImprovement } from "./extraction-quality.js";
import {
  fetchRenderedHtml,
  BrowserRenderingError,
} from "./browser-rendering-client.js";
import type { BrowserRenderingConfig } from "./browser-rendering-client.js";

export interface EnrichmentOutcome {
  status:
    | "applied"
    | "no_improvement"
    | "render_failed"
    | "document_missing"
    | "skipped";
  scoreBefore?: number;
  scoreAfter?: number;
  renderLatencyMs?: number;
}

export async function processEnrichmentJob(
  ctx: UserScopedDb,
  job: ExtractionEnrichmentJob,
  renderConfig: BrowserRenderingConfig
): Promise<EnrichmentOutcome> {
  const doc = await getDocument(ctx, job.document_id);
  if (!doc || doc.deleted_at) {
    return { status: "document_missing" };
  }

  if (doc.user_id !== job.user_id) {
    return { status: "skipped" };
  }

  const scoreBefore = scoreExtraction({
    title: doc.title,
    url: doc.url,
    htmlContent: doc.html_content,
    plainTextContent: doc.plain_text_content,
    author: doc.author,
    siteName: doc.site_name,
    publishedDate: doc.published_at,
    coverImageUrl: doc.cover_image_url,
    excerpt: doc.excerpt,
    wordCount: doc.word_count,
  });

  const renderStart = Date.now();
  let renderedHtml: string;
  try {
    renderedHtml = await fetchRenderedHtml(job.url, renderConfig);
  } catch (err) {
    if (err instanceof BrowserRenderingError && !err.retryable) {
      return {
        status: "render_failed",
        scoreBefore,
        renderLatencyMs: Date.now() - renderStart,
      };
    }
    throw err; // Retryable errors bubble up for queue retry
  }
  const renderLatencyMs = Date.now() - renderStart;

  const article = extractArticle(renderedHtml, job.url);
  const meta = extractMetadata(renderedHtml, job.url);

  const newTitle = article.title || meta.title || doc.title;
  const newHtmlContent = article.htmlContent || null;
  const newMarkdown = article.markdownContent || null;
  const newPlainText = newMarkdown
    ?.replace(/[#*_`\[\]()>~-]/g, "")
    .trim() || null;

  const scoreAfter = scoreExtraction({
    title: newTitle,
    url: job.url,
    htmlContent: newHtmlContent,
    plainTextContent: newPlainText,
    author: article.author || meta.author,
    siteName: article.siteName || meta.siteName,
    publishedDate: meta.publishedDate,
    coverImageUrl: meta.ogImage,
    excerpt: article.excerpt || meta.description,
    wordCount: article.wordCount,
  });

  if (!isImprovement(scoreBefore, scoreAfter, !!doc.html_content, !!newHtmlContent)) {
    return { status: "no_improvement", scoreBefore, scoreAfter, renderLatencyMs };
  }

  await enrichDocument(ctx, doc.id, {
    title: newTitle,
    html_content: newHtmlContent,
    markdown_content: newMarkdown,
    plain_text_content: newPlainText,
    excerpt: article.excerpt || meta.description || doc.excerpt,
    author: article.author || meta.author || doc.author,
    site_name: article.siteName || meta.siteName || doc.site_name,
    cover_image_url: meta.ogImage || doc.cover_image_url,
    word_count: article.wordCount || doc.word_count,
    reading_time_minutes: article.readingTimeMinutes || doc.reading_time_minutes,
    lang: meta.lang || doc.lang,
  });

  return { status: "applied", scoreBefore, scoreAfter, renderLatencyMs };
}
