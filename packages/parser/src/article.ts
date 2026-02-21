import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { sanitizeHtml } from "./sanitize.js";
import { htmlToMarkdown } from "./markdown.js";
import { countWords, estimateReadingTime } from "@focus-reader/shared";

export interface ExtractedArticle {
  title: string;
  author: string | null;
  htmlContent: string;
  markdownContent: string;
  excerpt: string | null;
  wordCount: number;
  readingTimeMinutes: number;
  siteName: string | null;
  readabilitySucceeded: boolean;
}

export function extractArticle(html: string, url: string): ExtractedArticle {
  const { document } = parseHTML(html);

  // Readability mutates the DOM, so we run it on the parsed document
  const reader = new Readability(document as unknown as Document, {
    charThreshold: 0,
  });
  const article = reader.parse();

  let title: string;
  let author: string | null;
  let rawHtml: string;
  let excerpt: string | null;
  let siteName: string | null;
  let readabilitySucceeded: boolean;

  if (article) {
    title = article.title || "";
    author = article.byline || null;
    rawHtml = article.content || "";
    excerpt = article.excerpt || null;
    siteName = article.siteName || null;
    readabilitySucceeded = true;
  } else {
    // Fallback: Readability couldn't extract — use the raw HTML body
    title = extractTitleFromHtml(html);
    author = null;
    rawHtml = html;
    excerpt = null;
    siteName = null;
    readabilitySucceeded = false;
  }

  const htmlContent = sanitizeHtml(rawHtml);
  const markdownContent = htmlToMarkdown(htmlContent);
  const wordCount = countWords(markdownContent);
  const readingTimeMinutes = estimateReadingTime(wordCount);

  return {
    title,
    author,
    htmlContent,
    markdownContent,
    excerpt,
    wordCount,
    readingTimeMinutes,
    siteName,
    readabilitySucceeded,
  };
}

function extractTitleFromHtml(html: string): string {
  const { document } = parseHTML(html);
  const titleEl = document.querySelector("title");
  if (titleEl) return titleEl.textContent || "";
  const h1 = document.querySelector("h1");
  if (h1) return h1.textContent || "";
  return "";
}
