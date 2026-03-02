import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { sanitizeHtml } from "./sanitize.js";
import { htmlToMarkdown } from "./markdown.js";
import { countWords, estimateReadingTime } from "@focus-reader/shared";

// Patterns for filtering out non-hero images (logos, icons, avatars) by src path or class name
const HERO_SKIP_SRC = /logo|icon|favicon|avatar|spinner|\.svg$/i;
const HERO_SKIP_CLASS = /avatar|logo|icon|profile|badge|emoji|gravatar/i;

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

    // Readability only extracts the main prose container and drops sibling elements.
    // Many sites (Nuxt, Next.js, Ghost, etc.) place the hero image in its own wrapper
    // div adjacent to—but outside—the article content div. Detect and prepend it.
    const heroSrc = findPreArticleHeroImage(html, rawHtml, url);
    if (heroSrc) {
      rawHtml = `<figure><img src="${heroSrc}" alt=""></figure>${rawHtml}`;
    }
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

/**
 * Detects a hero image that Readability dropped because it was in a sibling
 * container outside the main article prose div. Looks in the original HTML for
 * the last qualifying image that appears just before the article body text.
 * Returns an absolute URL, or null if nothing suitable is found.
 */
function findPreArticleHeroImage(
  originalHtml: string,
  articleHtml: string,
  url: string
): string | null {
  // If extracted content already starts with an image, nothing to prepend.
  if (/<img|<picture/i.test(articleHtml.substring(0, 600))) return null;

  // Extract a plain-text anchor from the first paragraph to locate where the
  // article body begins in the original HTML. Strip HTML comments first
  // (Vue/Nuxt SSR fragment markers like <!--[--> appear in Readability output).
  const strippedHtml = articleHtml.replace(/<!--.*?-->/gs, "");
  const firstTextMatch = strippedHtml.match(/<p[^>]*>\s*([A-Z][^<]{25,})/);
  if (!firstTextMatch) return null;

  const anchor = firstTextMatch[1].substring(0, 35).trim();
  const articleStartIdx = originalHtml.indexOf(anchor);
  if (articleStartIdx === -1) return null;

  // Parse only the HTML that precedes the article body text.
  const preHtml = originalHtml.substring(0, articleStartIdx);
  const { document } = parseHTML(`<html><body>${preHtml}</body></html>`);
  const imgs = Array.from(document.querySelectorAll("img")) as any[];

  // Walk through images in document order, keeping the last qualifying one.
  // The last qualifying image is the one closest to the article start — most
  // likely the hero — even if author avatars or other images appear before it.
  let candidate: string | null = null;

  for (const img of imgs) {
    // Resolve the image source: prefer explicit src, fall back to lazy attrs, then srcset.
    let src: string | null = img.getAttribute("src")?.trim() || null;
    if (!src) {
      for (const attr of ["data-src", "data-lazy-src", "data-original"]) {
        const v = img.getAttribute(attr)?.trim();
        if (v) { src = v; break; }
      }
    }
    if (!src) {
      const srcset = img.getAttribute("srcset");
      src = srcset?.split(",")[0]?.trim().split(/\s+/)[0]?.trim() || null;
    }
    if (!src || src.startsWith("data:")) continue;

    // Filter logos, icons, and other decorative images by src path.
    if (HERO_SKIP_SRC.test(src)) continue;

    // Filter by class name (avatars, profile photos, badges, etc.).
    const cls = img.getAttribute("class") || "";
    if (HERO_SKIP_CLASS.test(cls)) continue;

    // Filter images with explicitly tiny dimensions.
    const w = parseInt(img.getAttribute("width") || "0", 10);
    const h = parseInt(img.getAttribute("height") || "0", 10);
    if ((w > 0 && w < 100) || (h > 0 && h < 100)) continue;

    candidate = src;
  }

  if (!candidate) return null;

  try {
    return new URL(candidate, url).href;
  } catch {
    return null;
  }
}

function extractTitleFromHtml(html: string): string {
  const { document } = parseHTML(html);
  const titleEl = document.querySelector("title");
  if (titleEl) return titleEl.textContent || "";
  const h1 = document.querySelector("h1");
  if (h1) return h1.textContent || "";
  return "";
}
