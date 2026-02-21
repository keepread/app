# Metadata Extraction Enhancement Plan

**Version:** 1.0
**Date:** February 18, 2026
**Status:** Pending
**Prerequisites:** None (standalone improvement to existing parser package)

---

## 1. Motivation

Focus Reader's URL ingestion pipeline depends on `packages/parser/src/metadata.ts` to extract page metadata (title, author, description, image, date, etc.). The current implementation queries only 1–2 sources per field — primarily Open Graph meta tags and a single HTML fallback. Many sites provide richer structured data via JSON-LD, Twitter Cards, Microdata (`itemprop`), and `<time>` elements that we don't extract.

A reference implementation (metascraper, at `../references/metascraper`) demonstrates a plugin-based approach with 5–10 fallback sources per field, achieving 95%+ extraction accuracy. However, metascraper depends on cheerio, re2 (native binary), lodash, chrono-node, and got — all incompatible with or too heavy for Cloudflare Workers.

**Decision:** Port metascraper's extraction rules into the existing linkedom-based `extractMetadata()` function. Zero new dependencies. Full Workers compatibility.

---

## 2. Current State

### 2.1 Current `extractMetadata()` — `packages/parser/src/metadata.ts`

Returns a `PageMetadata` object:

```typescript
interface PageMetadata {
  title: string | null;
  description: string | null;
  author: string | null;
  siteName: string | null;
  ogImage: string | null;
  favicon: string | null;
  canonicalUrl: string | null;
  publishedDate: string | null;
}
```

Current extraction sources per field:

| Field         | Sources                                                           |
|---------------|-------------------------------------------------------------------|
| title         | `og:title` → `<title>`                                            |
| description   | `og:description` → `meta[name=description]`                       |
| author        | `meta[name=author]` → `meta[name=article:author]`                 |
| siteName      | `og:site_name`                                                    |
| ogImage       | `og:image` → `twitter:image`                                      |
| favicon       | `apple-touch-icon` → `link[rel=icon]` → `link[rel=shortcut icon]` |
| canonicalUrl  | `link[rel=canonical]` → `og:url`                                  |
| publishedDate | `article:published_time` → `meta[name=datePublished]`             |

### 2.2 Where `extractMetadata()` is called

1. **`packages/api/src/documents.ts`** — `createBookmark()` (line ~108). Called after `extractArticle()`. Metadata supplements Readability output (ogImage for cover, publishedDate, siteName fallback). If Readability fails, metadata becomes the primary source for the lightweight bookmark fallback.

2. **`packages/api/src/feed-polling.ts`** — `processItem()` (line ~130). When `fetch_full_content` is enabled, the fetched HTML is parsed for metadata to supplement feed item fields.

### 2.3 Adjacent code: `extractArticle()` — `packages/parser/src/article.ts`

Uses `@mozilla/readability` for article body extraction. Returns title, author, htmlContent, markdownContent, excerpt, wordCount, readingTimeMinutes, siteName. This function is NOT being changed — we are only enhancing the metadata extraction that supplements it.

---

## 3. Implementation Plan

### Phase 1 — JSON-LD + Twitter Cards + lang + feed discovery

**Goal:** Biggest accuracy improvement with minimal code. Adds the two most impactful new extraction sources (JSON-LD, Twitter Cards) and two new fields (lang, feedUrl).

#### Step 1: Add JSON-LD extraction helper

**File:** `packages/parser/src/metadata.ts`

Add a helper function that parses all `<script type="application/ld+json">` elements and finds the most relevant item (Article, NewsArticle, BlogPosting, WebPage, etc.):

```typescript
function extractJsonLd(document: Document): Record<string, any> | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const articleTypes = new Set([
    "Article", "NewsArticle", "BlogPosting", "TechArticle",
    "ScholarlyArticle", "Report", "WebPage", "Review",
  ]);

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      const items = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      // Prefer Article-like types, fall back to first item with a name/headline
      const article = items.find((i: any) => articleTypes.has(i["@type"]));
      if (article) return article;
      const named = items.find((i: any) => i.headline || i.name);
      if (named) return named;
    } catch {
      // Malformed JSON-LD — skip
    }
  }
  return null;
}
```

Key behaviors to match from metascraper:
- Handle `@graph` arrays (common on WordPress sites with Yoast SEO)
- Handle nested `author` objects (`author.name` vs `author` as string)
- Decode HTML entities in JSON-LD string values
- Handle `image` as string, object (`image.url`), or array (`image[0].url` or `image[0]`)

Reference: `../references/metascraper/packages/metascraper-helpers/src/index.js` — `$jsonld()` helper function.

#### Step 2: Expand `PageMetadata` interface

Add two new fields:

```typescript
export interface PageMetadata {
  title: string | null;
  description: string | null;
  author: string | null;
  siteName: string | null;
  ogImage: string | null;
  favicon: string | null;
  canonicalUrl: string | null;
  publishedDate: string | null;
  lang: string | null;        // NEW — ISO 639-1 language code
  feedUrl: string | null;      // NEW — RSS/Atom feed autodiscovery URL
}
```

#### Step 3: Enhance fallback chains in `extractMetadata()`

Update each field extraction to include JSON-LD and Twitter Card sources. The priority order follows metascraper's convention (OG → Twitter → JSON-LD → HTML):

```typescript
const jsonLd = extractJsonLd(document);

const title =
  getMeta("og:title") ||
  getMeta("twitter:title") ||
  getJsonLdString(jsonLd, "headline") ||
  getJsonLdString(jsonLd, "name") ||
  document.querySelector("title")?.textContent?.trim() ||
  null;

const description =
  getMeta("og:description") ||
  getMeta("twitter:description") ||
  getJsonLdString(jsonLd, "description") ||
  getMeta("description") ||
  null;

const author =
  getMeta("author") ||
  getMeta("article:author") ||
  getJsonLdAuthor(jsonLd) ||   // handles string | { name } | [{ name }]
  null;

const siteName =
  getMeta("og:site_name") ||
  getJsonLdString(jsonLd, "publisher.name") ||
  null;

const ogImage =
  getMeta("og:image") ||
  getMeta("twitter:image") ||
  getMeta("twitter:image:src") ||
  getJsonLdImage(jsonLd) ||    // handles string | { url } | [string] | [{ url }]
  null;

const publishedDate =
  getMeta("article:published_time") ||
  getMeta("datePublished") ||
  getJsonLdString(jsonLd, "datePublished") ||
  getJsonLdString(jsonLd, "dateCreated") ||
  null;

const lang =
  document.documentElement?.getAttribute("lang")?.split("-")[0] || // "en-US" → "en"
  getMeta("og:locale")?.split("_")[0] ||                           // "en_US" → "en"
  getJsonLdString(jsonLd, "inLanguage") ||
  null;

const feedUrl = extractFeedUrl(document, url); // see helper below
```

#### Step 4: Add JSON-LD value helpers

These small helpers handle the polymorphic shapes JSON-LD uses for author and image:

```typescript
function getJsonLdString(jsonLd: Record<string, any> | null, path: string): string | null {
  if (!jsonLd) return null;
  const parts = path.split(".");
  let value: any = jsonLd;
  for (const part of parts) {
    value = value?.[part];
    if (value == null) return null;
  }
  return typeof value === "string" ? value.trim() : null;
}

function getJsonLdAuthor(jsonLd: Record<string, any> | null): string | null {
  if (!jsonLd?.author) return null;
  const author = Array.isArray(jsonLd.author) ? jsonLd.author[0] : jsonLd.author;
  if (typeof author === "string") return author;
  return author?.name || null;
}

function getJsonLdImage(jsonLd: Record<string, any> | null): string | null {
  if (!jsonLd?.image) return null;
  const image = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
  if (typeof image === "string") return image;
  return image?.url || null;
}
```

#### Step 5: Add feed autodiscovery helper

```typescript
function extractFeedUrl(document: Document, baseUrl: string): string | null {
  const link = document.querySelector(
    'link[rel="alternate"][type="application/rss+xml"], ' +
    'link[rel="alternate"][type="application/atom+xml"], ' +
    'link[rel="alternate"][type="application/feed+json"]'
  );
  const href = link?.getAttribute("href");
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}
```

#### Step 6: Update callers for new fields

**`packages/api/src/documents.ts`** — `createBookmark()`:
- Store `lang` in document if a `lang` column is added (see Step 7), or ignore initially.
- `feedUrl` can be used for a "subscribe to this site's feed" feature in the UI — store it or ignore initially.

**`packages/api/src/feed-polling.ts`** — `processItem()`:
- No changes needed. New fields are additive.

#### Step 7: Schema migration (optional, for `lang` field)

If you want to persist `lang`:

```sql
-- Migration: add lang column to document
ALTER TABLE document ADD COLUMN lang TEXT;
```

Add to `packages/db/migrations/` with the next migration number. Update `createDocument()` query in `packages/db/src/queries/documents.ts` to include the new column.

The `feedUrl` field does NOT need to be persisted per-document — it's transient metadata that could power a "subscribe" button in the reading pane.

#### Step 8: Write tests

**File:** `packages/parser/src/__tests__/metadata.test.ts`

Test cases to add:

1. **JSON-LD Article** — HTML with `<script type="application/ld+json">` containing `@type: "Article"` with headline, author, image, datePublished. Verify all fields extracted.
2. **JSON-LD with @graph** — WordPress/Yoast-style JSON-LD with `@graph` array containing WebPage + Article + Person. Verify Article is selected.
3. **JSON-LD author variants** — Test `author` as string, `{ name: "..." }`, and `[{ name: "..." }]`.
4. **JSON-LD image variants** — Test `image` as string, `{ url: "..." }`, and `["url1", "url2"]`.
5. **Twitter Card fallback** — HTML with only `twitter:title`, `twitter:description`, `twitter:image` (no OG tags). Verify extraction.
6. **Language extraction** — `<html lang="en-US">` → `"en"`. `og:locale="fr_FR"` → `"fr"`.
7. **Feed autodiscovery** — `<link rel="alternate" type="application/rss+xml" href="/feed.xml">`. Verify absolute URL resolution.
8. **Malformed JSON-LD** — Invalid JSON in script tag. Verify graceful fallback to OG/HTML.
9. **No metadata at all** — Bare `<html><body>Hello</body></html>`. Verify all fields null.
10. **Priority ordering** — HTML with OG, Twitter, AND JSON-LD. Verify OG wins (highest priority).

Reference test fixtures: `../references/metascraper/packages/metascraper-title/test/` and similar test directories in each metascraper package contain real-world HTML from major publishers.

---

### Phase 2 — Microdata + `<time>` element + image heuristics

**Goal:** Add Microdata (itemprop) extraction and smarter fallbacks. Medium effort.

#### Step 9: Add Microdata extraction

Add `itemprop` attribute queries as additional fallbacks after JSON-LD:

```typescript
// In the title chain, after JSON-LD:
document.querySelector('[itemprop="headline"]')?.textContent?.trim() ||

// In the author chain:
document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
document.querySelector('[rel="author"]')?.textContent?.trim() ||

// In the image chain:
(document.querySelector('[itemprop="image"]') as HTMLImageElement)?.src ||
(document.querySelector('[itemprop="image"]') as HTMLMetaElement)?.getAttribute("content") ||

// In the date chain:
document.querySelector('[itemprop="datePublished"]')?.getAttribute("content") ||
document.querySelector('[itemprop="datePublished"]')?.getAttribute("datetime") ||

// In the siteName chain:
document.querySelector('[itemprop="publisher"] [itemprop="name"]')?.textContent?.trim() ||
```

#### Step 10: Add `<time>` element fallback for publishedDate

As a low-priority fallback for publishedDate:

```typescript
document.querySelector("time[datetime]")?.getAttribute("datetime") ||
```

This catches many blog engines that use semantic `<time>` elements without explicit meta tags.

#### Step 11: Add image heuristic fallback

When no OG/Twitter/JSON-LD/itemprop image is found, look for a large hero image:

```typescript
function findHeroImage(document: Document): string | null {
  // Look for common hero image patterns
  const selectors = [
    'article img[src]',
    'main img[src]',
    '.post-thumbnail img[src]',
    '.featured-image img[src]',
    '.entry-content img[src]',
  ];
  for (const selector of selectors) {
    const img = document.querySelector(selector);
    const src = img?.getAttribute("src");
    if (src) return src;
  }
  return null;
}
```

Add as the lowest-priority fallback in the ogImage chain.

#### Step 12: Add tests for Phase 2

Test cases:
1. **Microdata-only page** — HTML with itemprop attributes but no OG/JSON-LD. Verify extraction.
2. **`<time>` element** — Blog post with `<time datetime="2024-01-15T10:00:00Z">`. Verify date extracted.
3. **Hero image heuristic** — HTML with no meta images but `<article><img src="hero.jpg">`. Verify image found.
4. **Microdata priority** — Verify itemprop is lower priority than OG and JSON-LD.

---

### Phase 3 — Site-specific rules (optional, deferred)

**Goal:** Port vendor-specific extraction for URLs users commonly save. Only implement if usage data shows frequent saves from these sources.

Candidates:
- **YouTube** — Extract video title, channel name, thumbnail from URL patterns. Reference: `../references/metascraper/packages/metascraper-youtube/`
- **Twitter/X** — Extract tweet text, author handle. Reference: `../references/metascraper/packages/metascraper-x/`
- **GitHub** — Extract repo description, stars, README excerpt from API.

Implementation pattern (from metascraper):
```typescript
// Site-specific rules use a test() guard
function isYouTube(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\//.test(url);
}

// Then in extractMetadata, apply site-specific overrides
if (isYouTube(url)) {
  // YouTube-specific extraction
}
```

This phase should only be undertaken with data on which URLs users actually save.

---

## 4. Files Changed

### Phase 1
| File                                                                     | Change                                                                  |
|--------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `packages/parser/src/metadata.ts`                                        | Add JSON-LD helper, expand fallback chains, add `lang`/`feedUrl` fields |
| `packages/shared/src/types.ts` (or wherever PageMetadata is re-exported) | Update type if re-exported                                              |
| `packages/api/src/documents.ts`                                          | Handle new `lang`/`feedUrl` fields from metadata                        |
| `packages/db/migrations/NNNN_add_lang.sql`                               | Add `lang TEXT` column (optional)                                       |
| `packages/db/src/queries/documents.ts`                                   | Include `lang` in INSERT (optional)                                     |
| `packages/parser/src/__tests__/metadata.test.ts`                         | 10 new test cases                                                       |

### Phase 2
| File                                             | Change                                                        |
|--------------------------------------------------|---------------------------------------------------------------|
| `packages/parser/src/metadata.ts`                | Add itemprop queries, `<time>` fallback, hero image heuristic |
| `packages/parser/src/__tests__/metadata.test.ts` | 4 additional test cases                                       |

---

## 5. Dependencies

**No new npm dependencies.** All extraction uses linkedom's `document.querySelector()` and `JSON.parse()`.

---

## 6. Verification

After each phase:

```bash
pnpm build && pnpm typecheck && pnpm test
```

Additionally, manually test with real URLs that exercise each extraction source:
- A WordPress blog post (JSON-LD with @graph via Yoast)
- A news article from a major publisher (OG + JSON-LD + Twitter Cards)
- A minimal personal blog (HTML only, no meta tags)
- A GitHub README page (limited metadata)
- A page with RSS feed link (feed autodiscovery)

---

## 7. Reference Material

The metascraper reference code is at `../references/metascraper`. Key files to consult during implementation:

| What                              | Where                                                              |
|-----------------------------------|--------------------------------------------------------------------|
| JSON-LD extraction pattern        | `packages/metascraper-helpers/src/index.js` — `$jsonld()` function |
| Title extraction rules & priority | `packages/metascraper-title/src/index.js`                          |
| Author extraction rules           | `packages/metascraper-author/src/index.js`                         |
| Description extraction rules      | `packages/metascraper-description/src/index.js`                    |
| Image extraction rules            | `packages/metascraper-image/src/index.js`                          |
| Date extraction rules             | `packages/metascraper-date/src/index.js`                           |
| Language extraction rules         | `packages/metascraper-lang/src/index.js`                           |
| Feed discovery rules              | `packages/metascraper-feed/src/index.js`                           |
| Logo/favicon rules                | `packages/metascraper-logo-favicon/src/index.js`                   |
| Real-world test fixtures          | `packages/metascraper-*/test/` directories                         |
