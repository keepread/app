import { parseHTML } from "linkedom";
import { normalizeUrl } from "@focus-reader/shared";

export interface PageMetadata {
  title: string | null;
  description: string | null;
  author: string | null;
  siteName: string | null;
  ogImage: string | null;
  favicon: string | null;
  canonicalUrl: string | null;
  publishedDate: string | null;
  lang: string | null;
  feedUrl: string | null;
}

// --- Internal helpers ---

function resolveUrl(relative: string | null | undefined, base: string): string | null {
  if (!relative) return null;
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

const ARTICLE_TYPES = new Set([
  "Article",
  "NewsArticle",
  "BlogPosting",
  "TechArticle",
  "ScholarlyArticle",
  "Report",
  "WebPage",
  "SocialMediaPosting",
  "Review",
]);

function flattenJsonLdItems(data: unknown): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      items.push(...flattenJsonLdItems(item));
    }
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      items.push(...flattenJsonLdItems(obj["@graph"]));
    } else {
      items.push(obj);
    }
  }
  return items;
}

function hasArticleType(obj: Record<string, unknown>): boolean {
  const type = obj["@type"];
  if (typeof type === "string") return ARTICLE_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => typeof t === "string" && ARTICLE_TYPES.has(t));
  return false;
}

function findRelevantJsonLdItem(data: unknown): Record<string, unknown> | null {
  const items = flattenJsonLdItems(data);
  // Prefer article-type items
  const article = items.find(hasArticleType);
  if (article) return article;
  // Fall back to any item with headline/name
  return items.find((i) => i.headline || i.name) ?? null;
}

function extractJsonLd(doc: Document): Record<string, unknown> | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      const found = findRelevantJsonLdItem(data);
      if (found) return found;
    } catch {
      // Malformed JSON-LD — skip
    }
  }
  return null;
}

function jsonLdString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return jsonLdString(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim() || null;
    if (typeof obj.url === "string") return obj.url.trim() || null;
  }
  return null;
}

function jsonLdImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return jsonLdImageUrl(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url.trim() || null;
  }
  return null;
}

function jsonLdNestedString(
  jsonLd: Record<string, unknown> | null,
  path: string
): string | null {
  if (!jsonLd) return null;
  const parts = path.split(".");
  let current: unknown = jsonLd;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return jsonLdString(current);
}

function extractFeedUrl(doc: Document, baseUrl: string): string | null {
  const link = doc.querySelector(
    'link[rel="alternate"][type="application/rss+xml"], ' +
      'link[rel="alternate"][type="application/atom+xml"], ' +
      'link[rel="alternate"][type="application/feed+json"]'
  );
  const href = link?.getAttribute("href");
  return resolveUrl(href, baseUrl);
}

const SKIP_CLASS_PATTERN = /avatar|logo|icon|profile|badge|emoji|gravatar/i;
const LAZY_SRC_ATTRS = ["data-src", "data-lazy-src", "data-original"];

function findHeroImage(doc: Document, baseUrl: string): string | null {
  const images = Array.from(
    doc.querySelectorAll("article img, main img, .post img, .content img, body img")
  );
  for (const img of images) {
    const widthAttr = img.getAttribute("width");
    if (widthAttr && parseInt(widthAttr, 10) < 100) continue;
    const heightAttr = img.getAttribute("height");
    if (heightAttr && parseInt(heightAttr, 10) < 100) continue;

    const className = img.getAttribute("class") || "";
    if (SKIP_CLASS_PATTERN.test(className)) continue;

    let src: string | null = null;
    for (const attr of LAZY_SRC_ATTRS) {
      const val = img.getAttribute(attr);
      if (val) { src = val; break; }
    }
    if (!src) src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) continue;

    const resolved = resolveUrl(src, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

// --- Main extraction ---

export function extractMetadata(html: string, url: string): PageMetadata {
  const { document } = parseHTML(html);

  const getMeta = (property: string): string | null => {
    const el =
      document.querySelector(`meta[property="${property}"]`) ||
      document.querySelector(`meta[name="${property}"]`);
    return el?.getAttribute("content")?.trim() || null;
  };

  const jsonLd = extractJsonLd(document);

  // Title: JSON-LD → OG → Twitter → Dublin Core → <title>
  const title =
    jsonLdNestedString(jsonLd, "headline") ||
    jsonLdNestedString(jsonLd, "name") ||
    getMeta("og:title") ||
    getMeta("twitter:title") ||
    getMeta("dc.title") ||
    document.querySelector("title")?.textContent?.trim() ||
    null;

  // Description: JSON-LD → OG → Twitter → standard → Dublin Core
  const description =
    jsonLdNestedString(jsonLd, "description") ||
    getMeta("og:description") ||
    getMeta("twitter:description") ||
    getMeta("description") ||
    getMeta("dc.description") ||
    null;

  // Author: JSON-LD → meta → Dublin Core → Twitter → itemprop → rel
  const author =
    (jsonLd ? jsonLdString(jsonLd.author) : null) ||
    getMeta("author") ||
    getMeta("article:author") ||
    getMeta("dc.creator") ||
    getMeta("twitter:creator") ||
    document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
    document.querySelector('[rel="author"]')?.textContent?.trim() ||
    null;

  // Site name: JSON-LD publisher → OG → itemprop → application-name
  const siteName =
    (jsonLd ? jsonLdNestedString(jsonLd, "publisher.name") || jsonLdString(jsonLd.publisher) : null) ||
    getMeta("og:site_name") ||
    document.querySelector('[itemprop="publisher"] [itemprop="name"]')?.textContent?.trim() ||
    getMeta("application-name") ||
    null;

  // Image: JSON-LD → OG variants → Twitter → itemprop
  const rawImage =
    (jsonLd ? jsonLdImageUrl(jsonLd.image) : null) ||
    getMeta("og:image") ||
    getMeta("og:image:secure_url") ||
    getMeta("og:image:url") ||
    getMeta("twitter:image") ||
    getMeta("twitter:image:src") ||
    document.querySelector('[itemprop="image"]')?.getAttribute("content") ||
    document.querySelector('[itemprop="image"]')?.getAttribute("src") ||
    null;
  const ogImage = resolveUrl(rawImage, url) || findHeroImage(document, url);

  // Favicon: apple-touch-icon → icon → shortcut icon
  const favicon =
    resolveUrl(
      document.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href"),
      url
    ) ||
    resolveUrl(
      document.querySelector("link[rel='icon']")?.getAttribute("href"),
      url
    ) ||
    resolveUrl(
      document.querySelector("link[rel='shortcut icon']")?.getAttribute("href"),
      url
    ) ||
    null;

  // Canonical URL: link[rel=canonical] → og:url, then normalize (strips tracking params)
  const rawCanonical =
    resolveUrl(
      document.querySelector("link[rel='canonical']")?.getAttribute("href"),
      url
    ) ||
    getMeta("og:url") ||
    null;
  const canonicalUrl = rawCanonical ? normalizeUrl(rawCanonical) : null;

  // Published date: JSON-LD → meta variants → Dublin Core → itemprop → <time>
  const publishedDate =
    jsonLdNestedString(jsonLd, "datePublished") ||
    jsonLdNestedString(jsonLd, "dateCreated") ||
    getMeta("article:published_time") ||
    getMeta("datePublished") ||
    getMeta("dc.date") ||
    getMeta("dcterms.date") ||
    getMeta("date") ||
    document.querySelector('[itemprop="datePublished"]')?.getAttribute("content") ||
    document.querySelector('[itemprop="datePublished"]')?.getAttribute("datetime") ||
    document.querySelector("time[datetime]")?.getAttribute("datetime") ||
    null;

  // Language: <html lang> → og:locale → content-language → JSON-LD
  const rawLang =
    document.documentElement?.getAttribute("lang") ||
    getMeta("og:locale") ||
    (document.querySelector('meta[http-equiv="content-language"]') as Element | null)
      ?.getAttribute("content") ||
    jsonLdNestedString(jsonLd, "inLanguage") ||
    null;
  const lang = rawLang ? rawLang.split(/[-_]/)[0].toLowerCase() : null;

  // Feed URL: RSS → Atom → JSON Feed
  const feedUrl = extractFeedUrl(document, url);

  return {
    title,
    description,
    author,
    siteName,
    ogImage,
    favicon,
    canonicalUrl,
    publishedDate,
    lang,
    feedUrl,
  };
}
