# Phase 2 Implementation Plan: RSS, Search, and Power Features

**Version:** 1.0
**Date:** February 14, 2026
**Status:** Complete — Steps 10–20 complete
**Prerequisites:** Phase 1 complete (see `phase-1-plan.md` and `phase-1-implementation-gaps.md`)

---

## 1. Phase 2 Scope

Phase 2 transforms Focus Reader from a basic email-newsletter-and-bookmarks reader into a full daily-driver reading app. It adds RSS feed ingestion, full-text search, a Chrome browser extension, PDF support, filtered views, and completes the features deferred from Phase 1.

### 1.1 What Phase 1 Already Provides

- **Monorepo** — PNPM workspaces, Turborepo, all workspace shells
- **`packages/shared`** — All entity types (including Feed, Highlight, SavedView, UserPreferences, ApiKey, FeedToken), constants, URL/slug/time utilities
- **`packages/db`** — D1 migration with all tables created (feed, highlight, saved_view, user_preferences, api_key, feed_token, etc.), query helpers for documents, subscriptions, tags, email meta, denylist, ingestion log, attachments
- **`packages/parser`** — Email MIME parsing, article extraction (Readability), metadata extraction (OG tags), HTML sanitization (linkedom), Markdown conversion (turndown)
- **`packages/api`** — Business logic for documents, subscriptions, tags, denylist, auth (CF Access JWT + API key validation)
- **`apps/email-worker`** — Deployed, receiving emails, 17-step pipeline
- **`apps/web`** — Three-pane layout, document list with SWR, reading pane (HTML/Markdown), focus mode, tagging UI, subscription management, settings pages (general, subscriptions, denylist, email, ingestion log), keyboard shortcuts (s/m/e/f/Escape/[/]/Shift+H), mobile-responsive
- **D1 database** — All Phase 0–4 tables provisioned in `0001_initial_schema.sql`

### 1.2 What Phase 2 Adds

From PRD Section 7 — Phase 2 deliverables:

1. **RSS feed subscription and polling** — `apps/rss-worker` with Cron Triggers, feed parser in `packages/parser`, feed management UI
2. **OPML import/export** — import feeds from other readers, export subscribed feeds
3. **Full-text search (FTS5)** — search across title, author, content, tags; new migration for FTS5 virtual table
4. **Complete keyboard navigation** — j/k document navigation (deferred from Phase 1), command palette (Cmd+K)
5. **Browser extension (Chrome)** — `apps/extension`, save current page as article/bookmark, quick-tag picker
6. **Auto-tagging rules** — per-subscription, per-feed, and global rules based on domain/keywords
7. **Filtered views (saved queries)** — saved query-based views in the sidebar
8. **PDF upload and viewing** — file upload to R2, PDF.js reader, `Document_PDF_Meta`
9. **Confirmation email handling** — surface confirmation emails in UI, one-click open original link
10. **REST API expansion** — feeds, highlights, collections, API keys, search endpoints
11. **Dark mode** — `next-themes` already installed, wire up theme toggle

### 1.3 Phase 1 Deferred Items Addressed in Phase 2

- **Auth enforcement** (gap §1.1) — Wire `authenticateRequest()` into all API route handlers
- **j/k keyboard navigation** (gap §1.4) — Add `documentIds` and `currentIndex` to AppContext for list-level navigation
- **Web/API test coverage** (gap §1.8) — Establish `getCloudflareContext()` mocking pattern, add tests for all route handlers

### 1.4 What's Out (deferred to Phase 3+)

- Highlighting and annotation system (Phase 3)
- Collections (Phase 3)
- Social media post saving (Phase 3)
- Reading progress sync (Phase 3)
- Customizable reading preferences (Phase 3)
- Import from Instapaper/Pocket/Omnivore (Phase 3)
- AI summarization (Phase 4)
- Atom feed output (Phase 4)

---

## 2. New Dependencies

### 2.1 Packages to Add

| Package                  | Workspace         | Purpose                                            |
|--------------------------|-------------------|----------------------------------------------------|
| `rss-parser`             | `packages/parser` | RSS 2.0/Atom 1.0 feed parsing (Workers-compatible) |
| `opml-generator`         | `packages/parser` | OPML generation (or hand-roll — small format)      |
| `fast-xml-parser`        | `packages/parser` | OPML import parsing (lightweight, no DOM needed)   |
| `pdfjs-dist`             | `apps/web`        | Client-side PDF rendering                          |
| `wxt`                    | `apps/extension`  | Web extension framework (Vite-based, auto-manifest)|
| `@wxt-dev/module-react`  | `apps/extension`  | WXT React module for popup/options pages           |

> **Workers compatibility note:** `rss-parser` uses `xml2js` internally which uses Node.js streams. If it fails in Workers, replace with `fast-xml-parser` + a hand-rolled feed normalizer. The RSS worker runs in workerd, so all dependencies must be Workers-compatible. Test this early in Step 10.

### 2.2 New Workspace

| App                       | Path              | Runtime                                |
|---------------------------|-------------------|----------------------------------------|
| `focus-reader-rss-worker` | `apps/rss-worker` | Cloudflare Worker (Cron Trigger)       |
| `focus-reader-extension`  | `apps/extension`  | Chrome Extension (MV3, built with WXT) |

---

## 3. New Database Migration

### Migration `0002_fts5_search.sql`

The FTS5 virtual table and triggers for keeping it in sync with the `document` table. All other tables (feed, highlight, saved_view, etc.) already exist from `0001_initial_schema.sql`.

```sql
-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
  title,
  author,
  plain_text_content,
  markdown_content,
  content='document',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
-- Note: D1 uses TEXT primary keys, not INTEGER rowid.
-- FTS5 content= sync requires rowid. We use an explicit rowid alias approach:
-- Instead of content=, we manually manage the FTS index.

-- Populate FTS from existing documents
INSERT INTO document_fts(rowid, title, author, plain_text_content, markdown_content)
SELECT rowid, title, COALESCE(author, ''), COALESCE(plain_text_content, ''), COALESCE(markdown_content, '')
FROM document WHERE deleted_at IS NULL;
```

> **Implementation note:** D1/SQLite FTS5 with `content=` tables and TEXT primary keys is tricky. The safer approach is to manage the FTS index manually: insert into `document_fts` after every document create, update on content change, and delete on soft-delete. This avoids the rowid/text-pk mismatch. The triggers approach can be attempted but must be validated in workerd tests first.

---

## 4. Implementation Steps

Steps continue numbering from Phase 1 (Steps 6–9).

---

### Step 10: RSS Feed Parser and DB Queries ✅ COMPLETE

**Goal:** Add RSS/Atom feed parsing to `packages/parser` and feed CRUD queries to `packages/db`. No worker or UI yet — just the library layer.

**Status:** Complete (commits `e651fe8`, `5b37480`)

**Packages:** `packages/parser`, `packages/db`, `packages/shared`

#### 10a: Parser — RSS Feed Module

**New files:**

1. **`packages/parser/src/rss/fetch.ts`**
   ```typescript
   export interface FeedItem {
     guid: string;           // Unique item ID (guid or link)
     title: string;
     url: string;            // Item link
     author: string | null;
     contentHtml: string | null;  // content:encoded or description
     contentText: string | null;
     excerpt: string | null;
     publishedAt: string | null;  // ISO 8601
     coverImageUrl: string | null;
   }

   export interface ParsedFeed {
     title: string;
     description: string | null;
     siteUrl: string | null;
     iconUrl: string | null;
     items: FeedItem[];
   }

   /** Fetch and parse an RSS/Atom feed from a URL. */
   export async function fetchFeed(url: string): Promise<ParsedFeed>;

   /** Parse feed XML string directly (for testing without fetch). */
   export async function parseFeedXml(xml: string, feedUrl: string): Promise<ParsedFeed>;

   /** Auto-discover feed URL from a website HTML page. */
   export async function discoverFeedUrl(html: string, pageUrl: string): Promise<string | null>;
   ```

2. **`packages/parser/src/rss/opml.ts`**
   ```typescript
   export interface OpmlFeed {
     title: string;
     feedUrl: string;
     siteUrl: string | null;
   }

   /** Parse OPML XML into a list of feeds. */
   export function parseOpml(xml: string): OpmlFeed[];

   /** Generate OPML XML from a list of feeds. */
   export function generateOpml(feeds: OpmlFeed[], title?: string): string;
   ```

3. **`packages/parser/src/rss/index.ts`** — barrel export.

4. **Update `packages/parser/src/index.ts`** — add `export * from "./rss/index.js";`

5. **Update `packages/parser/tsup.config.ts`** — add `rss-parser` and `fast-xml-parser` to `external` if needed.

**New dependencies for `packages/parser`:**
- `fast-xml-parser` — lightweight XML parsing that works in Workers (no DOM required)

> **Decision (resolved):** Used `fast-xml-parser` directly rather than `rss-parser`, since `rss-parser` depends on `xml2js` which has Node.js-only dependencies. `fast-xml-parser` is Worker-safe and we normalize RSS 2.0 / Atom 1.0 / JSON Feed formats ourselves. `parseFeedXml()` and `discoverFeedUrl()` are synchronous (no async needed for pure parsing).

#### 10b: Database — Feed Query Helpers

**New file: `packages/db/src/queries/feeds.ts`**

```typescript
export async function createFeed(db: D1Database, input: CreateFeedInput): Promise<Feed>;
export async function getFeed(db: D1Database, id: string): Promise<Feed | null>;
export async function getFeedByUrl(db: D1Database, feedUrl: string): Promise<Feed | null>;
export async function listFeeds(db: D1Database): Promise<FeedWithStats[]>;
export async function updateFeed(db: D1Database, id: string, updates: UpdateFeedInput): Promise<void>;
export async function softDeleteFeed(db: D1Database, id: string): Promise<void>;
export async function hardDeleteFeed(db: D1Database, id: string): Promise<void>;
export async function getActiveFeeds(db: D1Database): Promise<Feed[]>;
export async function markFeedFetched(db: D1Database, id: string): Promise<void>;
export async function incrementFeedError(db: D1Database, id: string, error: string): Promise<void>;
export async function resetFeedErrors(db: D1Database, id: string): Promise<void>;
export async function getFeedsDueForPoll(db: D1Database): Promise<Feed[]>;
```

**New types in `packages/shared/src/types.ts`:**

```typescript
export interface CreateFeedInput {
  id?: string;
  feed_url: string;
  site_url?: string | null;
  title: string;
  description?: string | null;
  icon_url?: string | null;
  fetch_interval_minutes?: number;
  fetch_full_content?: number;
  auto_tag_rules?: string | null;
}

export interface UpdateFeedInput {
  title?: string;
  description?: string | null;
  icon_url?: string | null;
  fetch_interval_minutes?: number;
  is_active?: number;
  fetch_full_content?: number;
  auto_tag_rules?: string | null;
}

export interface FeedWithStats extends Feed {
  documentCount: number;
  unreadCount: number;
}

export interface ListDocumentsQuery {
  // ... existing fields ...
  feedId?: string;       // NEW: filter by feed source_id
  type?: DocumentType;   // NEW: filter by document type
}
```

**Update `packages/db/src/queries/documents.ts`:**
- Add `feedId` and `type` filter support to `listDocuments()` WHERE clause builder.

**Update `packages/db/src/queries/tags.ts`:**
- Add `addTagToFeed(db, feedId, tagId)`, `removeTagFromFeed(db, feedId, tagId)`, `getTagsForFeed(db, feedId)`.

**Update barrel exports:**
- `packages/db/src/index.ts` — add `export * from "./queries/feeds.js";`

#### 10c: Tests

- `packages/parser/src/__tests__/rss-fetch.test.ts` — parse RSS 2.0, Atom 1.0, JSON Feed 1.1 from fixture strings. Test `discoverFeedUrl()`.
- `packages/parser/src/__tests__/rss-opml.test.ts` — roundtrip OPML parse/generate.
- `packages/db/src/__tests__/feeds.test.ts` — CRUD, `getFeedsDueForPoll()`, error tracking. (Workerd test with `@cloudflare/vitest-pool-workers`.)

**Success criteria:**
- [x] `parseFeedXml()` correctly parses RSS 2.0 fixture (3 items covering all field variants)
- [x] `parseFeedXml()` correctly parses Atom 1.0 fixture
- [x] `parseFeedXml()` correctly parses JSON Feed 1.1 fixture
- [x] `discoverFeedUrl()` finds `<link rel="alternate" type="application/rss+xml">` in HTML
- [x] `parseOpml()` / `generateOpml()` roundtrip preserves all feed URLs and titles
- [x] `getFeedsDueForPoll()` returns only active feeds past their interval
- [x] `incrementFeedError()` increments error_count and sets last_error
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (179 tests, 0 failures)

---

### Step 11: RSS Worker — Feed Polling Engine ✅ COMPLETE

**Goal:** Create `apps/rss-worker` — a Cloudflare Worker with a Cron Trigger that polls RSS feeds and creates documents.

**Status:** Complete (commits `84326ab`, `4cd6dd3`)

**Packages:** `apps/rss-worker` (new), `packages/api`

#### 11a: Scaffold `apps/rss-worker`

**Directory structure:**
```
apps/rss-worker/
├── src/
│   ├── index.ts           # scheduled() handler
│   └── __tests__/
│       └── rss-worker.test.ts
├── wrangler.toml
├── vitest.config.ts       # @cloudflare/vitest-pool-workers
├── tsconfig.json
└── package.json
```

**`package.json`:**
```json
{
  "name": "focus-reader-rss-worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "echo 'Built by wrangler'",
    "dev": "wrangler dev --persist-to ../../.wrangler/state",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@focus-reader/shared": "workspace:*",
    "@focus-reader/db": "workspace:*",
    "@focus-reader/parser": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.12",
    "@cloudflare/workers-types": "^4",
    "typescript": "^5",
    "vitest": "~3.2.0",
    "wrangler": "^4"
  }
}
```

**`wrangler.toml`:**
```toml
name = "focus-reader-rss-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[triggers]
crons = ["*/15 * * * *"]

[[d1_databases]]
binding = "FOCUS_DB"
database_name = "focus-reader-db"
database_id = "<from-env>"
migrations_dir = "../../packages/db/migrations"

[miniflare]
d1_persist = "../../.wrangler/state/v3/d1"
```

#### 11b: RSS Worker Implementation

**`apps/rss-worker/src/index.ts`:**

```typescript
interface Env {
  FOCUS_DB: D1Database;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // 1. Query feeds due for poll (active, interval elapsed)
    // 2. For each feed (in parallel, batched):
    //    a. Fetch and parse feed XML
    //    b. For each item not already in DB (dedup by guid/url):
    //       i.   Sanitize HTML content
    //       ii.  Convert to Markdown
    //       iii. Compute word count / reading time
    //       iv.  Optionally fetch full article content if feed.fetch_full_content = 1
    //       v.   Create Document (type='rss', origin_type='feed', source_id=feed.id)
    //       vi.  Inherit feed tags
    //       vii. Log ingestion event
    //    c. Update feed.last_fetched_at, reset error_count
    //    d. On error: increment error_count, set last_error
    //       If error_count >= 5: set is_active = 0
  }
};
```

**Key design decisions:**
- Dedup RSS items by checking `getDocumentByUrl(db, normalizedItemUrl)` — same pattern as bookmark dedup.
- Process feeds in parallel with `Promise.allSettled()` to avoid one failing feed blocking others.
- Batch size: process up to 20 feeds per cron invocation to stay within Worker CPU limits. If more are due, they'll be picked up in the next 15-minute window.
- Full-content fetch: when `feed.fetch_full_content = 1`, use `extractArticle()` from `@focus-reader/parser` on the item URL after creating the base document from feed content.

#### 11c: API — Feed Business Logic

**New file: `packages/api/src/feeds.ts`**

```typescript
export async function getFeeds(db: D1Database): Promise<FeedWithStats[]>;
export async function addFeed(db: D1Database, url: string): Promise<Feed>;
export async function patchFeed(db: D1Database, id: string, updates: UpdateFeedInput): Promise<void>;
export async function removeFeed(db: D1Database, id: string, hard?: boolean): Promise<void>;
export async function importOpml(db: D1Database, xml: string): Promise<{ imported: number; skipped: number }>;
export async function exportOpml(db: D1Database): Promise<string>;
export async function tagFeed(db: D1Database, feedId: string, tagId: string): Promise<void>;
export async function untagFeed(db: D1Database, feedId: string, tagId: string): Promise<void>;
```

`addFeed()` should:
1. Fetch the URL to detect if it's a feed or a website page.
2. If website page: run `discoverFeedUrl()` to find the feed URL.
3. Check for duplicate by `getFeedByUrl()`.
4. Fetch and parse the feed to extract title, description, site_url, icon_url.
5. Create Feed record.

**Update `packages/api/src/index.ts`** — add `export * from "./feeds.js";`

#### 11d: Tests

- `apps/rss-worker/src/__tests__/rss-worker.test.ts` — workerd test simulating `scheduled` event with seeded feeds and mocked HTTP responses.
- `packages/api/src/__tests__/feeds.test.ts` — feed CRUD, OPML import/export.

**Status:** Complete (commits `84326ab`, `4cd6dd3`)

**Success criteria:**
- [x] Worker `scheduled()` handler polls due feeds and creates documents
- [x] RSS items deduplicated by normalized URL
- [x] Feed error count increments on failure, resets on success
- [x] Feed auto-deactivates after 5 consecutive errors
- [x] Feed tags inherited by new documents
- [x] Ingestion log entries created for each RSS item
- [x] `addFeed()` auto-discovers feed URL from website HTML
- [x] `importOpml()` creates feeds, skips duplicates, returns counts
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (197 tests, 0 failures)

---

### Step 12: Full-Text Search (FTS5) ✅ COMPLETE

**Goal:** Add a D1 migration for FTS5 indexes and wire search into the query/API/UI layers.

**Status:** Complete (commit `a5c370c`)

**Packages:** `packages/db`, `packages/api`, `apps/web`

#### 12a: Migration

**New file: `packages/db/migrations/0002_fts5_search.sql`**

```sql
-- FTS5 virtual table for full-text search across documents
CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
  doc_id UNINDEXED,
  title,
  author,
  plain_text_content,
  tokenize='porter unicode61'
);

-- Backfill existing documents
INSERT INTO document_fts(doc_id, title, author, plain_text_content)
SELECT id, title, COALESCE(author, ''), COALESCE(plain_text_content, '')
FROM document WHERE deleted_at IS NULL;
```

> **Design note:** We store `doc_id` (the TEXT UUID) as an UNINDEXED column in the FTS table to join back to the `document` table. We do NOT use `content=document` sync because D1 TEXT primary keys don't map to FTS5 rowids cleanly. Instead, we manually manage inserts/updates/deletes in the query layer.

**Update `packages/db/src/migration-sql.ts`** — embed the new migration SQL for workerd tests.

#### 12b: Database — Search Queries

**New file: `packages/db/src/queries/search.ts`**

```typescript
export interface SearchResult {
  documentId: string;
  snippet: string;
  rank: number;
}

/** Full-text search across documents. Returns matching document IDs with relevance-ranked snippets. */
export async function searchDocuments(
  db: D1Database,
  query: string,
  options?: { limit?: number; offset?: number; location?: DocumentLocation }
): Promise<{ results: SearchResult[]; total: number }>;

/** Insert a document into the FTS index. Call after createDocument(). */
export async function indexDocument(
  db: D1Database,
  doc: { id: string; title: string; author: string | null; plain_text_content: string | null }
): Promise<void>;

/** Remove a document from the FTS index. Call on soft-delete. */
export async function deindexDocument(db: D1Database, docId: string): Promise<void>;

/** Rebuild the entire FTS index from the document table. */
export async function rebuildSearchIndex(db: D1Database): Promise<void>;
```

**Update `packages/db/src/queries/documents.ts`:**
- After `createDocument()`: call `indexDocument()`.
- After `softDeleteDocument()`: call `deindexDocument()`.

**Update `packages/db/src/index.ts`** — add `export * from "./queries/search.js";`

#### 12c: API — Search Business Logic

**New file: `packages/api/src/search.ts`**

```typescript
export interface SearchDocumentsQuery {
  q: string;
  location?: DocumentLocation;
  type?: DocumentType;
  tagId?: string;
  limit?: number;
  offset?: number;
}

export async function searchDocuments(
  db: D1Database,
  query: SearchDocumentsQuery
): Promise<PaginatedResponse<DocumentWithTags & { snippet: string }>>;
```

**Update `packages/api/src/index.ts`** — add `export * from "./search.js";`

#### 12d: Web — Search UI and API Route

**New API route: `apps/web/src/app/api/search/route.ts`**
- `GET /api/search?q=...&location=...&type=...&tagId=...&limit=...&offset=...`

**New component: `apps/web/src/components/search/search-bar.tsx`**
- Debounced search input in the document list toolbar.
- Shows results inline in the document list area.
- Keyboard shortcut `/` focuses the search bar.

**New hook: `apps/web/src/hooks/use-search.ts`**
- `useSearch(query: string)` — SWR fetch to `/api/search?q=...`

#### 12e: Tests

- `packages/db/src/__tests__/search.test.ts` — FTS insert, search, deindex, rebuild. (Workerd test.)
- Search relevance: "typescript tutorial" matches document titled "TypeScript Tutorial for Beginners".

**Success criteria:**
- [x] FTS5 migration applies cleanly on fresh and existing databases
- [x] `searchDocuments()` returns relevant results with snippets
- [x] FTS index stays in sync: new documents indexed, soft-deleted documents deindexed
- [x] Search UI shows results with highlighted snippets
- [x] `/` shortcut focuses search bar
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (210 tests, 0 failures)

---

### Step 13: Auth Enforcement and API Key Management ✅ COMPLETE

**Goal:** Wire authentication into all API routes and add API key CRUD for programmatic access.

**Status:** Complete (commit `2ae89e0`)

**Packages:** `packages/db`, `packages/api`, `apps/web`

#### 13a: Database — API Key Queries

**New file: `packages/db/src/queries/api-keys.ts`**

```typescript
export async function createApiKey(db: D1Database, input: { key_hash: string; key_prefix: string; label: string }): Promise<ApiKey>;
export async function listApiKeys(db: D1Database): Promise<ApiKey[]>;
export async function revokeApiKey(db: D1Database, id: string): Promise<void>;
export async function getApiKeyByHash(db: D1Database, keyHash: string): Promise<ApiKey | null>;
```

**Update `packages/db/src/index.ts`** — add export.

#### 13b: API — API Key Business Logic

**New file: `packages/api/src/api-keys.ts`**

```typescript
/** Generate a new API key. Returns the plaintext key (shown once) and the created record. */
export async function generateApiKey(db: D1Database, label: string): Promise<{ key: string; record: ApiKey }>;

export async function listApiKeys(db: D1Database): Promise<ApiKey[]>;
export async function revokeApiKey(db: D1Database, id: string): Promise<void>;
```

`generateApiKey()` should:
1. Generate 32 random bytes via `crypto.getRandomValues()`.
2. Encode as hex string → this is the plaintext API key.
3. Compute SHA-256 hash for storage.
4. Store `key_prefix` (first 8 chars) for display.
5. Insert into `api_key` table.
6. Return plaintext key (never stored) + record.

#### 13c: Auth Middleware for API Routes

**New file: `apps/web/src/lib/auth-middleware.ts`**

```typescript
import { authenticateRequest } from "@focus-reader/api";
import { getDb, getEnv } from "./bindings";
import { jsonError } from "./api-helpers";

/**
 * Wraps an API route handler with authentication.
 * Returns 401 if not authenticated.
 * In dev mode (no CF_ACCESS env vars), allows all requests.
 */
export async function withAuth(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response>;
```

**Update all existing API route handlers** (`apps/web/src/app/api/**/*.ts`):
- Wrap each handler with `withAuth()`.
- Pattern: `return withAuth(request, async () => { /* existing handler body */ });`

#### 13d: Web — API Key Settings Page

**New route: `apps/web/src/app/settings/api-keys/page.tsx`**
- List existing API keys (prefix, label, created_at, last_used_at).
- "Create API key" button → shows plaintext key once in a dialog with copy button.
- "Revoke" button per key.

**New API routes:**
- `apps/web/src/app/api/api-keys/route.ts` — `GET` (list), `POST` (create)
- `apps/web/src/app/api/api-keys/[id]/route.ts` — `DELETE` (revoke)

**Update `apps/web/src/app/settings/layout.tsx`** — add "API Keys" nav entry.

#### 13e: Tests

- `packages/db/src/__tests__/api-keys.test.ts` — CRUD, hash lookup.
- `packages/api/src/__tests__/auth.test.ts` — `authenticateRequest()` with valid/invalid API keys, CF Access JWTs, dev mode passthrough.
- `apps/web/src/__tests__/auth-middleware.test.ts` — verify 401 on unauthenticated requests when auth env vars are configured.

**Success criteria:**
- [x] All API routes return 401 when CF Access env vars are set and no valid auth is provided
- [x] API routes pass through in dev mode (no CF_ACCESS env vars)
- [x] API key creation returns plaintext once, stores only hash
- [x] API key authentication works via `Authorization: Bearer <key>` header
- [x] Revoked keys are rejected
- [x] API keys settings page shows list with create/revoke actions
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (99 tests, 0 failures)

---

### Step 14: Keyboard Navigation, Dark Mode, and Confirmation Emails ✅ COMPLETE

**Goal:** Complete keyboard navigation (j/k + command palette), add dark mode support, and surface confirmation emails.

**Status:** Complete (commit `addccc9`)

**Packages:** `apps/web`, `packages/shared`, `packages/db`

#### 14a: j/k Document Navigation

The Phase 1 gap: j/k navigation requires the document list to share its item IDs with the keyboard handler in `AppShell`.

**Update `apps/web/src/contexts/app-context.tsx`:**

```typescript
// Add to AppState:
documentIds: string[];
setDocumentIds: (ids: string[]) => void;
currentDocumentIndex: number;
setCurrentDocumentIndex: (index: number) => void;
```

**Update `apps/web/src/components/documents/document-list.tsx`:**
- After SWR data loads, call `setDocumentIds(docs.map(d => d.id))`.
- When a document is clicked, update `currentDocumentIndex`.

**Update `apps/web/src/components/layout/app-shell.tsx`:**
- Add `j` → select next document (increment index, navigate to `?doc=<id>`).
- Add `k` → select previous document (decrement index).
- Add `o` / `Enter` → open selected document in reading view.

#### 14b: Command Palette (Cmd+K)

**New component: `apps/web/src/components/dialogs/command-palette.tsx`**
- Built on `cmdk` (already installed as dependency of shadcn command component).
- Commands: navigate to views (Inbox, Later, Archive, Starred, All), search, add URL, toggle theme, toggle focus mode, keyboard shortcuts reference.
- Keyboard shortcut: `Meta+k` (Mac) / `Ctrl+k` (Windows).

**Update `apps/web/src/components/layout/app-shell.tsx`:**
- Add `Meta+k` / `Ctrl+k` shortcut to open command palette.
- Render `<CommandPalette />` in the shell.

#### 14c: Dark Mode

`next-themes` is already installed and `ThemeProvider` is in the root layout. The CSS variables use oklch colors. What's needed:

**Update `apps/web/src/app/globals.css`:**
- Add `.dark` variant CSS variables (oklch dark palette matching shadcn new-york).
- Ensure all custom styles use CSS variables (no hardcoded colors).

**Update `apps/web/src/app/settings/page.tsx`:**
- Wire the existing theme toggle to `useTheme()` from `next-themes`.
- Options: Light, Dark, System.

**Verify:** All shadcn/ui components already support dark mode via CSS variables. Audit custom components for hardcoded colors.

#### 14d: Confirmation Email Handling

**Update `apps/web/src/components/documents/document-list-item.tsx`:**
- Show a "Confirmation needed" badge on documents where the email meta has `needs_confirmation = 1`.

**Update `apps/web/src/components/reader/reader-toolbar.tsx`:**
- For confirmation emails: show a banner with "This is a confirmation email" and a button to open the original link in a new tab (extract first `<a href>` from the HTML content).

**Update `packages/api/src/documents.ts`:**
- In `getDocumentDetail()`: include `emailMeta` when the document type is `email`.

**Update `packages/shared/src/types.ts`:**
```typescript
export interface DocumentWithTags extends Document {
  tags: Tag[];
  subscription?: Subscription;
  emailMeta?: DocumentEmailMeta;  // NEW
}
```

**Update `packages/db/src/queries/documents.ts`:**
- In `getDocumentWithTags()`: join `document_email_meta` when type is `email`.

**Success criteria:**
- [x] `j`/`k` moves selection up/down in the document list (highlight only, no reading view)
- [x] `Enter` opens the selected document in reading view; `o` opens original URL in new tab
- [x] `Cmd+K` opens the command palette with navigation commands
- [x] Dark mode togglable from settings and persists across sessions (already complete from Phase 1)
- [x] All UI components render correctly in both light and dark mode
- [x] Confirmation emails show badge in list and banner in reader
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (232 tests, 0 failures)

---

### Step 15: RSS Feed Management UI and Web API Routes ✅ COMPLETE

**Goal:** Add feed management pages and API routes for the web app.

**Status:** Complete (commit `8c82e92`)

**Packages:** `apps/web`, `apps/email-worker`

#### 15a: API Routes for Feeds

**New files:**
- `apps/web/src/app/api/feeds/route.ts` — `GET` (list feeds with stats), `POST` (add feed by URL)
- `apps/web/src/app/api/feeds/[id]/route.ts` — `PATCH` (update), `DELETE` (soft/hard delete)
- `apps/web/src/app/api/feeds/[id]/tags/route.ts` — `POST` (tag feed), `DELETE` (untag feed)
- `apps/web/src/app/api/feeds/import/route.ts` — `POST` (OPML import, multipart file upload)
- `apps/web/src/app/api/feeds/export/route.ts` — `GET` (OPML export, returns XML)

#### 15b: Feed Management UI

**New hook: `apps/web/src/hooks/use-feeds.ts`**
```typescript
export function useFeeds(): SWRResponse<FeedWithStats[]>;
export function useFeed(id: string): SWRResponse<Feed>;
```

**New settings page: `apps/web/src/app/settings/feeds/page.tsx`**
- List all feeds with: title, site URL, icon, tags, last fetched, item count, error status, active/inactive toggle.
- "Add Feed" button → dialog to enter URL (auto-discovers feed from website).
- Per-feed actions: edit (rename, set interval, toggle full content), assign tags, delete.
- OPML import button (file upload).
- OPML export button (download).

**Update `apps/web/src/app/settings/layout.tsx`:**
- Add "Feeds" nav entry.

**Update sidebar (`apps/web/src/components/layout/nav-sidebar.tsx`):**
- Add "Feeds" section below "Subscriptions", listing active feeds.
- Each feed links to `/feeds/[id]` view showing that feed's documents.

**New reader route: `apps/web/src/app/(reader)/feeds/[id]/page.tsx`**
- Shows documents filtered by `feedId=<id>`, same layout as subscriptions/[id].

#### 15c: Feed Type Filter in Document List

**Update `apps/web/src/components/documents/document-list-toolbar.tsx`:**
- Add type filter dropdown: All, Articles, Emails, RSS, Bookmarks, PDFs.

**Update `apps/web/src/hooks/use-documents.ts`:**
- Support `type` and `feedId` query params in the SWR key.

**Additional changes:**
- Fixed infinite re-render loop in `useDocuments`/`useSearch` (memoized derived arrays with `useMemo`)
- Fixed missing `DialogTitle` accessibility warning in `CommandDialog`
- Fixed email-worker dev port conflict with rss-worker (added `--port 8788 --inspector-port 9230`)

**Success criteria:**
- [x] Feed management page shows all feeds with stats and error status
- [x] "Add Feed" auto-discovers feed URL from website URL
- [x] OPML import creates feeds from uploaded file
- [x] OPML export downloads valid OPML XML
- [x] Sidebar shows feeds section with feed-specific document views
- [x] Document type filter works in the list toolbar
- [x] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 16: PDF Upload and Viewing ✅ COMPLETE

**Goal:** Upload PDFs to R2, extract metadata, and render them in the reading pane.

**Status:** Complete (commits `bb9615c`, `0eb8c1b`)

**Packages:** `packages/parser`, `packages/db`, `packages/api`, `apps/web`

#### 16a: Parser — PDF Metadata Extraction

**New file: `packages/parser/src/pdf.ts`**

```typescript
export interface PdfMetadata {
  title: string | null;
  author: string | null;
  pageCount: number;
  fileSizeBytes: number;
}

/**
 * Extract metadata from a PDF binary.
 * Uses a lightweight approach — parse the PDF header/trailer for metadata
 * without rendering. For text extraction, we rely on the client-side PDF.js.
 */
export function extractPdfMetadata(buffer: ArrayBuffer, filename: string): PdfMetadata;
```

> **Implementation note:** Full PDF text extraction in Workers is heavyweight. For Phase 2, extract basic metadata server-side (title from info dict if available, fallback to filename). Text content extraction for search indexing can be done client-side via PDF.js and sent back via API, or deferred to Phase 3.

**Update `packages/parser/src/index.ts`** — add export.

#### 16b: Database — PDF Meta Queries

**New file: `packages/db/src/queries/pdf-meta.ts`**

```typescript
export async function createPdfMeta(db: D1Database, input: CreatePdfMetaInput): Promise<void>;
export async function getPdfMeta(db: D1Database, documentId: string): Promise<DocumentPdfMeta | null>;
```

**New type in `packages/shared/src/types.ts`:**
```typescript
export interface CreatePdfMetaInput {
  document_id: string;
  page_count: number;
  file_size_bytes: number;
  storage_key: string;
}
```

**Update `packages/db/src/index.ts`** — add export.

#### 16c: API — PDF Upload Logic

**Update `packages/api/src/documents.ts`:**

```typescript
export async function createPdfDocument(
  db: D1Database,
  r2: R2Bucket,
  file: ArrayBuffer,
  filename: string
): Promise<Document>;
```

`createPdfDocument()` should:
1. Generate document UUID.
2. Upload PDF binary to R2 at `pdfs/${docId}/${filename}`.
3. Extract metadata (title, page count, file size).
4. Create Document record (`type='pdf'`, `origin_type='manual'`).
5. Create DocumentPdfMeta record.
6. Return the created document.

#### 16d: Web — PDF Upload and Viewer

**New API route: `apps/web/src/app/api/documents/upload/route.ts`**
- `POST` — accept multipart/form-data with PDF file. Calls `createPdfDocument()`.

**Update `apps/web/src/components/dialogs/add-bookmark-dialog.tsx`:**
- Add a tab or toggle for "Upload PDF" alongside "Add URL".
- File picker restricted to `.pdf`.

**New component: `apps/web/src/components/reader/pdf-viewer.tsx`**
- Uses `pdfjs-dist` for client-side PDF rendering.
- Basic controls: page navigation, zoom, scroll.
- Lazy-loads the PDF from `/api/documents/[id]/content` (which serves the R2 binary).

**Update `apps/web/src/app/api/documents/[id]/content/route.ts`:**
- For PDF documents: fetch from R2 using `storage_key` from `document_pdf_meta` and return with `Content-Type: application/pdf`.

**Update `apps/web/src/components/reader/reader-content.tsx`:**
- Detect `document.type === 'pdf'` → render `<PdfViewer />` instead of HTML/Markdown.

**New dependency for `apps/web`:**
- `pdfjs-dist` — PDF.js for client-side rendering.

#### 16e: Tests

- `packages/parser/src/__tests__/pdf.test.ts` — metadata extraction from a small test PDF.
- `packages/db/src/__tests__/pdf-meta.test.ts` — CRUD operations.

**Success criteria:**
- [x] PDF upload creates document + PDF meta + R2 object
- [x] PDF viewer renders pages (iframe-based viewer)
- [x] PDF content endpoint streams binary from R2 with correct Content-Type
- [x] PDF metadata (title, page count, size) extracted and stored
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (273 tests, 0 failures)

---

### Step 17: Auto-Tagging Rules ✅ COMPLETE

**Goal:** Implement auto-tagging rules that apply tags based on domain, keywords, or sender patterns.

**Status:** Complete (commits `bb9615c`, `0eb8c1b`)

**Packages:** `packages/shared`, `packages/api`, `apps/web`

#### 17a: Auto-Tag Rule Schema

The `auto_tag_rules` field on `Subscription` and `Feed` is already a TEXT (JSON) column. Define the rule structure:

**New file: `packages/shared/src/auto-tag.ts`**

```typescript
export interface AutoTagRule {
  tagId: string;
  conditions: AutoTagCondition[];
  matchMode: "all" | "any";  // AND vs OR
}

export interface AutoTagCondition {
  field: "title" | "author" | "domain" | "sender" | "content";
  operator: "contains" | "equals" | "matches";  // matches = regex
  value: string;
}

export function evaluateAutoTagRules(
  rules: AutoTagRule[],
  document: { title: string; author: string | null; url: string | null; plain_text_content: string | null }
): string[];  // Returns tag IDs to apply
```

**Update `packages/shared/src/index.ts`** — add export.

#### 17b: Apply Auto-Tag Rules During Ingestion

**Update `apps/email-worker/src/index.ts`:**
- After creating the document and inheriting subscription tags (step 16 in pipeline), evaluate `subscription.auto_tag_rules` and apply matching tags.

**Update `apps/rss-worker/src/index.ts`:**
- After creating the document and inheriting feed tags, evaluate `feed.auto_tag_rules` and apply matching tags.

#### 17c: Auto-Tag Rule UI

**Update `apps/web/src/app/settings/subscriptions/page.tsx`:**
- Per-subscription "Auto-tag rules" editor (simple form: field, operator, value, target tag).

**Update `apps/web/src/app/settings/feeds/page.tsx`:**
- Per-feed "Auto-tag rules" editor (same pattern).

**New component: `apps/web/src/components/settings/auto-tag-editor.tsx`**
- Reusable form for editing auto-tag rules JSON.
- Add/remove rules, each with condition fields and tag picker.

**Success criteria:**
- [x] Auto-tag rules evaluated on email ingestion (email-worker integration)
- [x] Auto-tag rules evaluated on RSS ingestion (rss-worker integration)
- [x] Rule editor UI allows creating/editing rules per subscription and feed
- [x] Rule with `title contains "AI"` correctly tags matching documents
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (273 tests, 0 failures)

---

### Step 18: Filtered Views (Saved Queries) ✅ COMPLETE

**Goal:** Allow users to create saved query-based views that appear in the sidebar.

**Status:** Complete (commits `bb9615c`, `0eb8c1b`)

**Packages:** `packages/db`, `packages/api`, `apps/web`

#### 18a: Database — Saved View Queries

**New file: `packages/db/src/queries/saved-views.ts`**

```typescript
export async function createSavedView(db: D1Database, input: CreateSavedViewInput): Promise<SavedView>;
export async function listSavedViews(db: D1Database): Promise<SavedView[]>;
export async function getSavedView(db: D1Database, id: string): Promise<SavedView | null>;
export async function updateSavedView(db: D1Database, id: string, updates: UpdateSavedViewInput): Promise<void>;
export async function deleteSavedView(db: D1Database, id: string): Promise<void>;
```

**New types in `packages/shared/src/types.ts`:**

```typescript
export interface CreateSavedViewInput {
  name: string;
  query_ast_json: string;
  sort_json?: string | null;
  is_system?: number;
  pinned_order?: number | null;
}

export interface UpdateSavedViewInput {
  name?: string;
  query_ast_json?: string;
  sort_json?: string | null;
  pinned_order?: number | null;
}

// Query AST for saved views
export interface ViewQueryAst {
  filters: ViewFilter[];
  combinator: "and" | "or";
}

export interface ViewFilter {
  field: "type" | "location" | "is_read" | "is_starred" | "tag" | "source" | "author" | "domain" | "word_count" | "reading_time" | "saved_after" | "saved_before" | "published_after" | "published_before";
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "in";
  value: string | number | string[];
}
```

**Update `packages/db/src/index.ts`** — add export.

#### 18b: API — Saved View Business Logic

**New file: `packages/api/src/saved-views.ts`**

```typescript
export async function getSavedViews(db: D1Database): Promise<SavedView[]>;
export async function createSavedView(db: D1Database, input: CreateSavedViewInput): Promise<SavedView>;
export async function updateSavedView(db: D1Database, id: string, updates: UpdateSavedViewInput): Promise<void>;
export async function deleteSavedView(db: D1Database, id: string): Promise<void>;

/** Convert a ViewQueryAst to a ListDocumentsQuery for execution. */
export function queryAstToDocumentQuery(ast: ViewQueryAst): ListDocumentsQuery;
```

**Update `packages/api/src/index.ts`** — add export.

#### 18c: Web — Saved Views UI

**New API routes:**
- `apps/web/src/app/api/saved-views/route.ts` — `GET`, `POST`
- `apps/web/src/app/api/saved-views/[id]/route.ts` — `PATCH`, `DELETE`

**New hook: `apps/web/src/hooks/use-saved-views.ts`**
```typescript
export function useSavedViews(): SWRResponse<SavedView[]>;
```

**Update sidebar (`apps/web/src/components/layout/nav-sidebar.tsx`):**
- Add "Saved Views" section with pinned views.
- "Create View" button opens a dialog.

**New component: `apps/web/src/components/dialogs/create-view-dialog.tsx`**
- Form to build a query: add filter rows (field + operator + value), set combinator, name the view.

**New reader route: `apps/web/src/app/(reader)/views/[id]/page.tsx`**
- Loads the saved view's query AST, converts to `ListDocumentsQuery`, fetches documents.

**Seed default views (system-defined):**
- On first app load, if no saved views exist, create system views:
  - "Newsletters" — `type eq email`
  - "RSS" — `type eq rss`
  - "Recently Read" — `is_read eq 1`, sort by `last_read_at desc`

**Success criteria:**
- [x] Users can create, edit, and delete saved views
- [x] Saved views appear in the sidebar and show correct filtered documents
- [x] System default views (Newsletters, RSS, Recently Read) created on first load
- [x] View query AST serialized as JSON and stored in D1
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (273 tests, 0 failures)

---

### Step 19: Browser Extension (Chrome) — WXT Framework ✅ COMPLETE

**Goal:** Create a Chrome extension (Manifest V3) using the [WXT framework](https://wxt.dev/) that saves the current page to Focus Reader.

**Status:** Complete (commit `a7678dd`)

**Packages:** `apps/extension` (new), `packages/api`, `apps/web`

> **Why WXT?** WXT is the leading web extension framework (Vite-based, file-based entrypoints, auto-generated manifest, HMR in dev, first-class TypeScript, cross-browser support). It eliminates manual `manifest.json` authoring and the custom `tsup` bundling config that a raw extension would require. WXT's React module (`@wxt-dev/module-react`) provides zero-config JSX support for popup and options pages.

#### 19a: Scaffold `apps/extension`

Bootstrap the workspace using WXT's scaffolding with `srcDir` mode so source lives under `src/`:

```bash
cd apps && npx wxt@latest init extension --template react
```

Then adjust to fit the monorepo. Final directory structure:

```
apps/extension/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts              # defineBackground() — service worker
│   │   ├── content.ts                 # defineContentScript() — page HTML capture
│   │   ├── popup/                     # Popup UI (React)
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   └── style.css
│   │   └── options/                   # Options UI (React)
│   │       ├── index.html
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       └── style.css
│   ├── lib/
│   │   └── api-client.ts             # Focus Reader API calls
│   ├── components/
│   │   └── TagPicker.tsx              # Reusable tag selector
│   ├── assets/
│   │   └── icon.svg                   # Extension icon (WXT generates sizes)
│   └── public/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── wxt.config.ts                      # WXT configuration
├── tsconfig.json
└── package.json
```

**`package.json`:**
```json
{
  "name": "focus-reader-extension",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "wxt build",
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "zip": "wxt zip",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "clean": "rm -rf .output .wxt"
  },
  "dependencies": {
    "@focus-reader/shared": "workspace:*",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@wxt-dev/module-react": "^1",
    "typescript": "^5",
    "vitest": "~3.2.0",
    "wxt": "^0.19"
  }
}
```

**`wxt.config.ts`:**
```typescript
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Focus Reader",
    description: "Save articles, bookmarks, and web pages to Focus Reader",
    permissions: ["activeTab", "storage"],
    commands: {
      "save-page": {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Save current page to Focus Reader",
      },
    },
  },
  // Target Chrome first; Firefox/Safari support is free via WXT's browser abstraction
  browser: "chrome",
});
```

> **Manifest generation:** WXT auto-generates `manifest.json` from the entrypoints directory and the `manifest` key in `wxt.config.ts`. Background, content scripts, popup, and options entries are all inferred from the file structure — no manual manifest authoring needed.

#### 19b: Extension Implementation

**`src/entrypoints/background.ts`:**
```typescript
import { defineBackground } from "wxt/sandbox";

export default defineBackground(() => {
  // Handle the "save-page" keyboard command
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "save-page") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // Send message to content script to capture page HTML
      const html = await browser.tabs.sendMessage(tab.id, { action: "capture-html" });

      // Save via API
      const { savePage } = await import("../lib/api-client");
      await savePage(tab.url!, html, { type: "article" });
    }
  });
});
```

> **Note:** WXT provides a `browser` global (unified WebExtension API) that works across Chrome, Firefox, and Safari — no need for manual `chrome.*` vs `browser.*` branching.

**`src/entrypoints/content.ts`:**
```typescript
import { defineContentScript } from "wxt/sandbox";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    // Listen for capture requests from background/popup
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "capture-html") {
        sendResponse(document.documentElement.outerHTML);
      }
      return true; // Keep message channel open for async response
    });
  },
});
```

**`src/lib/api-client.ts`:**
- Functions to call Focus Reader API: `savePage(url, html, options)`, `getTags()`.
- Reads API URL and API key from `browser.storage.sync` (WXT's unified API).
- Uses `@focus-reader/shared` types for API request/response typing.

```typescript
import type { Tag, DocumentWithTags } from "@focus-reader/shared";

interface SavePageOptions {
  type?: "article" | "bookmark";
  tagIds?: string[];
}

export async function getConfig(): Promise<{ apiUrl: string; apiKey: string }>;
export async function savePage(url: string, html: string | null, options?: SavePageOptions): Promise<DocumentWithTags>;
export async function getTags(): Promise<Tag[]>;
export async function testConnection(): Promise<boolean>;
```

**`src/entrypoints/popup/App.tsx`:**
- Shows current tab title and URL (via `browser.tabs.query`).
- "Save as Article" button (captures page HTML via content script, sends to API).
- "Save as Bookmark" button (sends URL only).
- Quick-tag picker: fetch tags from API, allow selecting tags before save.
- Save confirmation with link to document in Focus Reader.
- Loading, success, and error states.

**`src/entrypoints/options/App.tsx`:**
- Form to configure:
  - Focus Reader URL (e.g., `https://reader.yourdomain.com`)
  - API key (input with show/hide toggle)
- "Test Connection" button — calls `/api/tags` to verify settings work.
- Settings persisted to `browser.storage.sync`.

**`src/components/TagPicker.tsx`:**
- Checkbox list of available tags, fetched from the API.
- Used in both the popup (quick-tag on save) and potentially the options page.

#### 19c: Extension API Route Support

**Update `apps/web/src/app/api/documents/route.ts`:**
- `POST` body should accept an optional `html` field for the extension to send page HTML directly.
- When `html` is provided, skip the server-side fetch and use the provided HTML for extraction.
- Add CORS headers for the extension origin.

**New utility: `apps/web/src/lib/cors.ts`:**
```typescript
export function withCors(response: Response, origin?: string): Response;
```
- Add `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods` headers.
- Allow the extension origin (configurable via env var `EXTENSION_ORIGINS`).

**New route: `apps/web/src/app/api/documents/route.ts` OPTIONS handler:**
- Return 204 with CORS headers for preflight requests from the extension.

#### 19d: Dev Workflow

WXT provides a superior development experience out of the box:

- `pnpm --filter focus-reader-extension dev` — launches Chrome with the extension auto-loaded, HMR for popup/options React components, fast reload for background/content scripts.
- `pnpm --filter focus-reader-extension dev:firefox` — same for Firefox.
- `pnpm --filter focus-reader-extension zip` — packages the extension as a `.zip` ready for Chrome Web Store submission.

The `.output/` directory contains the built extension. WXT handles all Vite configuration, manifest generation, and asset bundling internally.

#### 19e: Tests

- `apps/extension/src/__tests__/api-client.test.ts` — mock `browser.storage.sync` and `fetch`, test `savePage()`, `getTags()`, `testConnection()`.

> **Note:** WXT provides `wxt/testing` utilities and works with Vitest's `fake-browser` for mocking the WebExtension APIs in unit tests.

**Success criteria:**
- [x] `wxt build` produces a valid Chrome extension in `.output/chrome-mv3/`
- [x] Extension popup shows current page title and save options
- [x] "Save as Article" captures page HTML via content script and sends to API
- [x] "Save as Bookmark" sends URL only
- [x] Tag picker fetches and displays available tags
- [x] Options page allows configuring URL and API key, persists to storage
- [x] `Alt+Shift+S` shortcut triggers save via background script
- [x] CORS headers allow extension to call API
- [x] `wxt dev` launches Chrome with HMR working for popup/options
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (283 tests, 0 failures)

---

### Step 20: Web/API Test Coverage ✅ COMPLETE

**Goal:** Establish the testing strategy for web app API routes and achieve comprehensive coverage.

**Status:** Complete (commit `2de0e89`)

**Packages:** `apps/web`

#### 20a: Test Infrastructure

**New file: `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

**New file: `apps/web/src/__tests__/setup.ts`**

```typescript
import { vi } from "vitest";

/**
 * Mock @opennextjs/cloudflare's getCloudflareContext().
 * Creates in-memory stubs for D1Database and R2Bucket.
 */
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    env: {
      FOCUS_DB: createMockD1(),
      FOCUS_STORAGE: createMockR2(),
      EMAIL_DOMAIN: "read.example.com",
    },
  }),
}));

function createMockD1(): D1Database { /* ... */ }
function createMockR2(): R2Bucket { /* ... */ }
```

> **Alternative approach:** If mocking D1 is too complex, use `miniflare` directly in tests to get real D1/R2 bindings. This is heavier but more reliable. Decide based on how complex the mock becomes.

**Update `apps/web/package.json`:**
- Change `"test"` script from the placeholder echo to `"vitest run"`.
- Add `vitest: "~3.2.0"` to devDependencies.

#### 20b: API Route Tests

Write tests for all API route handlers. Each test mocks `getCloudflareContext()` and calls the route handler directly.

**Test files:**
- `apps/web/src/__tests__/api/documents.test.ts` — list, create bookmark, get, patch, delete
- `apps/web/src/__tests__/api/tags.test.ts` — CRUD, document tagging
- `apps/web/src/__tests__/api/subscriptions.test.ts` — CRUD, tag management
- `apps/web/src/__tests__/api/feeds.test.ts` — CRUD, OPML import/export
- `apps/web/src/__tests__/api/search.test.ts` — search queries
- `apps/web/src/__tests__/api/api-keys.test.ts` — create, list, revoke
- `apps/web/src/__tests__/api/denylist.test.ts` — CRUD

**Success criteria:**
- [x] Mocking strategy for `@/lib/bindings` established (mock getDb/getEnv/getR2, dev mode auth passthrough)
- [x] All API routes have at least one test for each HTTP method (81 tests across 16 files)
- [x] Auth middleware tested (authenticated and unauthenticated paths)
- [x] Error cases tested (404, 400 validation, 409 duplicate)
- [x] CORS headers tested (documents + tags routes)
- [x] `pnpm build && pnpm typecheck && pnpm test` passes (364 tests, 0 failures)

---

## 5. Step Dependency Graph

```
Step 10 (RSS parser + DB queries)
   │
   ├──→ Step 11 (RSS worker) ──────────────────────┐
   │         │                                       │
   │         └──→ Step 15 (RSS UI + API routes) ─────┤
   │                                                 │
   ├──→ Step 12 (FTS5 search)                        │
   │                                                 │
   ├──→ Step 13 (Auth + API keys) ──→ Step 19 (Extension)
   │                                                 │
   ├──→ Step 14 (j/k, dark mode, confirmation) ──────┤
   │                                                 │
   ├──→ Step 16 (PDF upload/viewing) ────────────────┤
   │                                                 │
   ├──→ Step 17 (Auto-tagging) ──────────────────────┤
   │         depends on Step 11 (rss-worker exists)  │
   │                                                 │
   ├──→ Step 18 (Filtered views) ────────────────────┤
   │                                                 │
   └──→ Step 20 (Test coverage) ─────────────────────┘
                   depends on Step 13 (auth to test)
```

### Parallelization Opportunities

The following steps can run **in parallel** after Step 10 is complete:

| Track | Steps        | Description                                                |
|-------|--------------|------------------------------------------------------------|
| **A** | 11 → 15 → 17 | RSS worker → feed UI → auto-tagging                        |
| **B** | 12           | Full-text search (independent)                             |
| **C** | 13 → 19      | Auth enforcement → browser extension                       |
| **D** | 14           | Keyboard nav, dark mode, confirmation emails (independent) |
| **E** | 16           | PDF upload/viewing (independent)                           |
| **F** | 18           | Filtered views (independent)                               |

Step 20 (test coverage) should run last, after all features are implemented, so tests cover the final surface area.

### Recommended Build Order (serial)

If implementing sequentially rather than in parallel:

1. **Step 10** — Foundation: RSS parsing + feed DB queries
2. **Step 13** — Auth enforcement (addresses Phase 1 gap, needed for extension)
3. **Step 11** — RSS worker
4. **Step 12** — Full-text search
5. **Step 14** — j/k navigation, dark mode, confirmation emails
6. **Step 15** — RSS feed management UI
7. **Step 16** — PDF upload/viewing
8. **Step 17** — Auto-tagging rules
9. **Step 18** — Filtered views
10. **Step 19** — Browser extension
11. **Step 20** — Test coverage

---

## 6. Conventions and Constraints

All Phase 2 work must follow these rules from AGENTS.md:

- **Vitest** pinned to `~3.2.0` — do NOT upgrade (breaks `@cloudflare/vitest-pool-workers`)
- **wrangler** `^4` — for all Cloudflare workers
- **ESM imports** with `.js` extensions: `import { foo } from "./bar.js"`
- **tsup** for package bundling (ESM only, dts, es2022 target, workspace deps external)
- **No DOMPurify** — use manual linkedom sanitizer in `packages/parser/src/sanitize.ts`
- **D1 foreign keys NOT enforced** — implement cascading deletes at application level
- **Query helpers** take `db: D1Database` as first parameter (dependency injection)
- **All entity types** live in `packages/shared/src/types.ts`
- **Workerd tests** — no filesystem reads, embed fixtures as strings, use `db.prepare().run()` not `db.exec()`
- **Run `pnpm build && pnpm typecheck && pnpm test` before committing**

---

## 7. Phase 2 Exit Criteria

Phase 2 is complete when ALL of the following are true:

- [x] RSS feeds can be subscribed, polled, and documents ingested automatically
- [x] OPML import/export works for feed migration
- [x] Full-text search returns relevant results across all documents
- [x] j/k keyboard navigation works in the document list
- [x] Command palette (Cmd+K) provides quick navigation
- [x] Chrome extension saves articles and bookmarks with tag picker
- [x] Auto-tagging rules run on email and RSS ingestion
- [x] Saved views appear in the sidebar with correct filtered results
- [x] PDFs can be uploaded, stored in R2, and viewed in the reading pane
- [x] Confirmation emails are surfaced with visual indicators
- [x] All API routes enforce authentication when CF Access env vars are set
- [x] API keys can be created, used, and revoked via settings
- [x] Dark mode works across all components
- [x] Web/API test coverage meets baseline (all routes tested — 81 tests across 16 files)
- [x] `pnpm build && pnpm typecheck && pnpm test` passes with zero failures
