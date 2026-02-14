# Phase 1 Implementation Plan: Minimal Viable Reader

**Version:** 2.0
**Date:** February 13, 2026
**Status:** Draft
**Prerequisites:** Phase 0 complete (monorepo scaffolding, D1 schema, email ingestion pipeline deployed and validated)

---

## 1. Phase 1 Scope

Phase 1 delivers a functional reader for browsing email newsletters and manually saved articles/bookmarks. It builds on the Phase 0 foundation (monorepo, shared types, database schema, email parsing, email worker) and adds the API layer, web UI, article/bookmark saving, and all user-facing features.

### 1.1 What Phase 0 Already Provides

The following are complete and deployed before Phase 1 begins:

- **Monorepo scaffolding** — PNPM workspaces, Turborepo, root config files, all workspace shells
- **`packages/shared`** — TypeScript types for all entities, constants, URL/slug/time utilities
- **`packages/db`** — D1 migration (all tables), schema constants, query helpers for email ingestion (document create/get/update, email meta CRUD, subscription create/lookup, ingestion logging, denylist check, attachment create)
- **`packages/parser`** — Email MIME parsing, deduplication, validation, confirmation detection, HTML sanitization, Markdown conversion
- **`apps/email-worker`** — Deployed and receiving emails, auto-creating subscriptions, writing documents to D1
- **D1 database** — Populated with real newsletter data from Phase 0 validation

### 1.2 What Phase 1 Adds

- **Article saving** — URL paste with Readability extraction, OG/meta fallback, deduplication by normalized URL
- **Bookmark saving** — Lightweight URL save with metadata extraction (title, description, favicon, OG image)
- **API business logic** — `packages/api` with document, subscription, tag, and auth operations
- **Web API routes** — Next.js API routes as thin wrappers around `@focus-reader/api`
- **Web UI** — Three-pane layout (sidebar, document list, reading pane), list view, HTML/Markdown toggle, focus mode, mobile-responsive
- **Subscription management UI** — List, rename, copy email address, assign tags, toggle active/inactive
- **Basic tagging UI** — Create/edit/delete tags, assign to documents and subscriptions, filter views by tag
- **Document triage** — Inbox / Later / Archive locations with UI controls
- **Reading state** — Mark read/unread (auto-mark after 1.5s), star/unstar documents
- **Authentication** — Cloudflare Access for browser sessions, API key support for programmatic access
- **Basic keyboard shortcuts** — j/k navigation, star, read/unread, archive, focus mode

### 1.3 What's Out (deferred to Phase 2+)

- RSS feed subscription and polling (`apps/rss-worker`)
- Browser extension (`apps/extension`)
- Full-text search (FTS5)
- Full keyboard navigation shortcut set
- Auto-tagging rules
- Filtered views / saved queries
- PDF upload and viewing
- Highlights and annotations
- Collections
- Dark mode
- OPML import/export
- Social media post saving
- Reading progress tracking and sync
- Customizable reading preferences (font, size, width)
- AI summarization
- Atom feed output

---

## 2. Implementation Steps

The plan is organized into 5 sequential steps. Each step builds on the previous and produces a testable, buildable state. Step numbering continues from Phase 0 (Steps 1–5) for traceability.

---

### Step 6: Extend Shared Packages — Article Parser, DB Queries, API Logic

**Goal:** Extend `packages/parser` with article extraction, extend `packages/db` with list/filter/CRUD queries needed by the UI, and populate `packages/api` with all Phase 1 business logic.

#### 6a: Parser — Article Extraction

Add article and bookmark content extraction to `packages/parser`.

**Deliverables:**

1. **`src/article/extract.ts`** — Article extraction using `@mozilla/readability`:
   - `extractArticle(html: string, url: string): ExtractedArticle | null` — extract title, author, content HTML, published date, excerpt, site name.
   - `ExtractedArticle` type: `{ title, author, contentHtml, publishedDate, excerpt, siteName }`

2. **`src/article/metadata.ts`** — Metadata extraction:
   - `extractMetadata(html: string): PageMetadata` — extract Open Graph tags, `<meta>` description, favicon URL, canonical URL.
   - `PageMetadata` type: `{ title, description, author, siteName, ogImage, favicon, canonicalUrl, publishedDate }`

3. **`src/article/index.ts`** — barrel export for article submodule.

4. **Update `src/index.ts`** — re-export article submodule.

5. **Tests:**
   - Article extraction tests with fixture HTML pages (news article, blog post, minimal page).
   - Metadata extraction tests (pages with full OG tags, partial tags, no tags).
   - Edge cases: pages where Readability returns null (fallback to metadata-only bookmark).

#### 6b: Database — Extended Query Helpers

Add the list/filter/paginate and CRUD queries needed by the API and UI layers.

**Deliverables:**

1. **`src/queries/documents.ts`** — Extend with:
   - `softDeleteDocument(db: D1Database, id: string): Promise<void>`
   - `listDocuments(db: D1Database, filters: ListDocumentsQuery): Promise<PaginatedResponse<Document>>` — filter by location, type, source_id, tag_id, is_read, is_starred; sort by saved_at, published_at; paginate with page + pageSize
   - Internal helper: `buildWhereClause(filters)` for dynamic filtering

2. **`src/queries/subscriptions.ts`** — Extend with:
   - `listSubscriptions(db): Promise<Subscription[]>`
   - `updateSubscription(db, id: string, updates: Partial<Subscription>): Promise<Subscription>`
   - `softDeleteSubscription(db, id: string): Promise<void>`
   - `hardDeleteSubscription(db, id: string): Promise<void>` — cascade delete documents, email meta, tags, attachments

3. **`src/queries/tags.ts`** — Extend with:
   - `listTags(db): Promise<Tag[]>`
   - `updateTag(db, id: string, updates: Partial<Tag>): Promise<Tag>`
   - `deleteTag(db, id: string): Promise<void>` — cascade remove from all join tables
   - `removeTagFromDocument(db, documentId: string, tagId: string): Promise<void>`
   - `getTagsForDocument(db, documentId: string): Promise<Tag[]>`
   - `addTagToSubscription(db, subscriptionId: string, tagId: string): Promise<void>`
   - `removeTagFromSubscription(db, subscriptionId: string, tagId: string): Promise<void>`

4. **`src/queries/denylist.ts`** — Extend with:
   - `addDenylistEntry(db, entry: CreateDenylistInput): Promise<Denylist>`
   - `removeDenylistEntry(db, id: string): Promise<void>`
   - `listDenylist(db): Promise<Denylist[]>`

5. **`src/queries/attachments.ts`** — Extend with:
   - `getAttachmentsForDocument(db, documentId: string): Promise<Attachment[]>`

6. **Tests:** Additional query tests for all new functions.

#### 6c: API Package — Business Logic

Populate `packages/api` with business logic for all Phase 1 operations. These are framework-agnostic functions that accept a D1 binding and return typed results.

**Deliverables:**

1. **Add to `packages/shared/src/types.ts`** — API request/response types:
   - `CreateDocumentRequest`, `UpdateDocumentRequest`, `ListDocumentsQuery`
   - `PaginatedResponse<T>`, `ApiError`
   - `SubscriptionWithStats`, `TagWithCount`
   - `AuthResult`

2. **`src/documents.ts`:**
   - `createDocumentFromUrl(db: D1Database, url: string): Promise<Document>` — fetch URL, extract article (Readability) or bookmark metadata (OG tags), deduplicate by normalized URL, sanitize HTML, convert to Markdown, compute word count/reading time, create Document.
   - `getDocument(db, id): Promise<Document & { tags: Tag[], emailMeta?: DocumentEmailMeta }>`
   - `listDocuments(db, filters): Promise<PaginatedResponse<Document>>`
   - `updateDocument(db, id, updates): Promise<Document>` — update location, read status, star, etc.
   - `deleteDocument(db, id): Promise<void>` — soft delete.
   - `triageDocument(db, id, location): Promise<Document>` — move to inbox/later/archive.

3. **`src/subscriptions.ts`:**
   - `listSubscriptions(db): Promise<SubscriptionWithStats[]>` — includes unread count, last received date (computed via subqueries on Document table).
   - `updateSubscription(db, id, updates): Promise<Subscription>`
   - `deleteSubscription(db, id, hard: boolean): Promise<void>`
   - `createSubscription(db, input): Promise<Subscription>` — generate pseudo email from display name.

4. **`src/tags.ts`:**
   - `createTag(db, input): Promise<Tag>`
   - `listTags(db): Promise<TagWithCount[]>` — includes document count.
   - `updateTag(db, id, updates): Promise<Tag>`
   - `deleteTag(db, id): Promise<void>` — cascade remove from join tables.
   - `tagDocument(db, documentId, tagId): Promise<void>`
   - `untagDocument(db, documentId, tagId): Promise<void>`
   - `tagSubscription(db, subscriptionId, tagId): Promise<void>`
   - `untagSubscription(db, subscriptionId, tagId): Promise<void>`

5. **`src/auth.ts`:**
   - `validateApiKey(db, keyHeader: string): Promise<boolean>` — hash the bearer token, look up in `API_Key` table.
   - `validateCfAccessJwt(jwt: string, ownerEmail: string): Promise<boolean>` — verify Cloudflare Access JWT, check email claim against `OWNER_EMAIL`.
   - `authenticateRequest(db, request: Request, env: Env): Promise<AuthResult>` — unified auth check (try CF Access cookie first, then API key header).

6. **`src/index.ts`** — barrel export.

7. **Tests:** Integration tests with miniflare D1:
   - Document creation from URL (mocked fetch for article and bookmark).
   - URL deduplication (same URL returns existing document).
   - Document listing with filters (location, type, tag, read/unread, starred).
   - Triage operations (inbox → later → archive).
   - Subscription CRUD with stats.
   - Tag CRUD with cascading deletes.
   - Auth validation (valid/invalid API key, valid/invalid CF Access JWT).

---

### Step 7: Web Application — API Routes

**Goal:** Implement the Next.js API route layer in `apps/web` as thin wrappers around `@focus-reader/api`.

**Deliverables:**

1. **Cloudflare bindings setup:**
   - `apps/web/env.ts` — typed environment bindings (`FOCUS_DB: D1Database`, `FOCUS_STORAGE: R2Bucket`, `OWNER_EMAIL: string`)
   - Utility to get bindings in route handlers via `getRequestContext()` from `@cloudflare/next-on-pages`

2. **Auth middleware:**
   - `apps/web/middleware.ts` — verify Cloudflare Access JWT on all routes (except public health check if needed). For API routes, also accept `Authorization: Bearer <key>`.

3. **API routes:**
   - `app/api/documents/route.ts`:
     - `GET` — list documents with query params (location, type, tag, source_id, is_read, is_starred, page, sort)
     - `POST` — create document (accept `url` for article/bookmark, or raw content)
   - `app/api/documents/[id]/route.ts`:
     - `GET` — get single document with tags and email meta
     - `PATCH` — update document (location, is_read, is_starred, title)
     - `DELETE` — soft delete
   - `app/api/subscriptions/route.ts`:
     - `GET` — list subscriptions with stats
     - `POST` — create subscription
   - `app/api/subscriptions/[id]/route.ts`:
     - `PATCH` — update subscription
     - `DELETE` — delete subscription (query param `hard=true` for hard delete)
   - `app/api/tags/route.ts`:
     - `GET` — list tags with counts
     - `POST` — create tag
   - `app/api/tags/[id]/route.ts`:
     - `PATCH` — update tag
     - `DELETE` — delete tag
   - `app/api/documents/[id]/tags/route.ts`:
     - `POST` — add tag to document
     - `DELETE` — remove tag from document
   - `app/api/subscriptions/[id]/tags/route.ts`:
     - `POST` — add tag to subscription
     - `DELETE` — remove tag from subscription

4. **Response format:** All API responses follow a consistent JSON envelope:
   ```json
   { "data": ..., "meta": { "page": 1, "pageSize": 50, "total": 123 } }
   ```
   Errors: `{ "error": { "code": "NOT_FOUND", "message": "..." } }`

5. **Tests:** API route tests using Vitest + miniflare.

---

### Step 8: Web Application — Layout and Core Components

**Goal:** Build the three-pane layout shell, sidebar, document list, and reading pane components.

**Deliverables:**

1. **Layout shell:**
   - `app/layout.tsx` — root layout with HTML head, theme support (light only for Phase 1), global styles
   - `app/(reader)/layout.tsx` — three-pane layout shell with responsive breakpoints
   - `app/page.tsx` — redirect to `/inbox`

2. **Sidebar (`components/layout/sidebar.tsx`):**
   - **System views:** Inbox (with unread count badge), Later, Archive, All, Starred
   - **Subscriptions section:** collapsible list of active subscriptions with unread counts, grouped by tag if tagged
   - **Tags section:** collapsible list of tags with document counts
   - **Footer:** link to Settings
   - Active view is highlighted
   - Mobile: hidden by default, slide-in from left via hamburger button

3. **Document list (`components/layout/document-list.tsx`):**
   - Header: view title, document count
   - List view: compact rows with thumbnail (OG image or type icon fallback), title, source/author, relative date, preview snippet, read/unread indicator (bold title for unread), star indicator
   - Click to select document (opens in reading pane)
   - "Load more" pagination (50 per page)
   - Empty state for views with no documents

4. **Reading pane (`components/layout/reading-pane.tsx`):**
   - Document header: title, author/source, date, reading time, star button, triage buttons (Inbox / Later / Archive), tag display
   - Content area: renders sanitized HTML by default
   - HTML/Markdown toggle button
   - Focus mode toggle (expand to full width, hide sidebar + list)
   - Empty state when no document is selected

5. **Shared UI components (`components/ui/`):**
   - Button, Input, Dialog/Modal, Dropdown, Badge, Spinner, EmptyState, Toast/Notification
   - Use Tailwind CSS for styling

6. **Data fetching hooks:**
   - `hooks/useDocuments.ts` — SWR/React Query hook for fetching and mutating documents
   - `hooks/useSubscriptions.ts` — hook for subscription data
   - `hooks/useTags.ts` — hook for tag data

7. **Responsive behavior:**
   - Desktop (≥1024px): three-pane, all visible
   - Tablet (768–1023px): two-pane (list + reader), sidebar via hamburger
   - Mobile (<768px): single-pane stacked navigation

---

### Step 9: Web Application — Pages, Features, and Settings

**Goal:** Wire up all reader pages, subscription management, tag management, content saving, and settings.

**Deliverables:**

1. **Reader pages (route groups):**
   - `app/(reader)/inbox/page.tsx` — documents where `location = 'inbox'`
   - `app/(reader)/later/page.tsx` — documents where `location = 'later'`
   - `app/(reader)/archive/page.tsx` — documents where `location = 'archive'`
   - `app/(reader)/starred/page.tsx` — documents where `is_starred = 1`
   - `app/(reader)/all/page.tsx` — all documents
   - `app/(reader)/subscriptions/[id]/page.tsx` — documents for a specific subscription
   - `app/(reader)/tags/[id]/page.tsx` — documents for a specific tag

2. **Subscription management:**
   - `app/(reader)/subscriptions/page.tsx` — list all subscriptions with display name, pseudo email (copy button), sender, tags, last received date, unread count, active/inactive toggle
   - Inline rename (click to edit display name)
   - Tag assignment via tag picker component
   - "New Subscription" button: generates pseudo email, shows copy-to-clipboard dialog

3. **Tag management:**
   - Tag picker component (reusable dropdown for assigning tags to documents/subscriptions)
   - Create new tag inline (name + color picker)
   - Edit/delete tags via sidebar or settings

4. **Add content:**
   - "Add URL" dialog (accessible via toolbar button) — input URL, detect type (article vs bookmark), save
   - Calls `POST /api/documents` with the URL
   - Loading state while fetching/parsing, success/error toast

5. **Settings pages (minimal for Phase 1):**
   - `app/settings/page.tsx` — settings hub with links to sub-pages
   - `app/settings/email/page.tsx` — shows configured email domain, denylist management (add/remove domains)
   - `app/settings/ingestion-log/page.tsx` — table of recent ingestion events with status, errors

6. **Basic keyboard shortcuts:**
   - `j` / `k` — next/previous document in list
   - `s` — star/unstar
   - `m` — toggle read/unread
   - `e` — archive document
   - `f` — toggle focus mode
   - `Escape` — close reading pane / deselect
   - Shortcuts disabled while focus is inside editable inputs

7. **Auto-mark as read:** After 1.5 seconds of focused visibility on a document, auto-mark as read. Manual toggle always available via `m` key or UI button.

---

## 3. Dependency Order

```
Phase 0 (Steps 1–5): Complete
    └── Step 6: Extend packages (parser + db + api)
        └── Step 7: apps/web API routes
            └── Step 8: apps/web layout and core components
                └── Step 9: apps/web pages, features, settings
```

Step 6 sub-parts (6a, 6b, 6c) are partially parallelizable:
- 6a (parser/article) and 6b (db/queries) can run in parallel (both depend only on packages/shared).
- 6c (api) depends on both 6a and 6b.

---

## 4. Local Development Workflow

```bash
# Terminal 1: Start everything
pnpm dev

# This starts (via Turborepo):
#   - apps/web:           wrangler pages dev (Next.js on port 8788)
#   - apps/email-worker:  wrangler dev (Email Worker)
#   Both share the same D1/R2 state via --persist-to ../../.wrangler/state

# Terminal 2: Run tests
pnpm test                           # All tests
pnpm --filter @focus-reader/api test  # Just api tests
pnpm --filter apps/web test           # Just web tests

# Apply migrations to local D1 (already done in Phase 0, but safe to re-run)
pnpm db:migrate
```

**Testing the full loop locally:**
1. Send a test email to the email worker (via fixture or real email)
2. Open `http://localhost:8788` in the browser
3. Verify the email appears in the Inbox view
4. Save an article by URL paste
5. Test triage, tagging, starring, read/unread

---

## 5. Deployment Checklist

Phase 0 infrastructure is already deployed. Phase 1 adds the web app:

1. **Cloudflare Access** (if not already configured in Phase 0):
   - Access application configured for the Pages domain
   - Access policy allowing only `OWNER_EMAIL`

2. **Secrets for `apps/web`:**
   - `OWNER_EMAIL` set via `wrangler secret put`
   - D1 database ID and R2 bucket name in `apps/web/wrangler.toml`

3. **Deploy:**
   - Deploy web app: `cd apps/web && wrangler pages deploy`
   - Re-deploy email worker if any shared package changes affect it: `cd apps/email-worker && wrangler deploy`

4. **Validation:**
   - Open the web UI and verify newsletters from Phase 0 are visible in the Inbox
   - Save 2 articles by URL paste and verify rendering (Readability extraction, HTML/Markdown toggle)
   - Save 1 bookmark and verify metadata display
   - Test triage (inbox → later → archive)
   - Test tagging (create tag, assign to document, filter by tag)
   - Test subscription management (rename, copy email, assign tags, toggle active)
   - Test star/unstar and mark read/unread
   - Test focus mode
   - Test on mobile device
   - Test keyboard shortcuts (j/k, s, m, e, f, Escape)

---

## 6. Success Criteria

Phase 1 is complete when:

- [ ] User can browse newsletters (from Phase 0) in a three-pane reader UI
- [ ] User can save articles by pasting a URL (Readability extraction with clean rendering)
- [ ] User can save bookmarks by pasting a URL (lightweight metadata)
- [ ] User can triage documents through inbox → later → archive
- [ ] User can create tags and assign them to documents and subscriptions
- [ ] User can star/unstar and mark read/unread
- [ ] Auto-mark as read works after 1.5s of focused visibility
- [ ] User can manage subscriptions (rename, copy email, assign tags, toggle active)
- [ ] User can create new subscriptions and get a pseudo email to copy
- [ ] HTML/Markdown toggle works in the reading pane
- [ ] Focus mode works (reading pane expands to full width)
- [ ] UI is responsive on desktop, tablet, and mobile
- [ ] Authentication works via Cloudflare Access
- [ ] Keyboard shortcuts work (j/k, s, m, e, f, Escape)
- [ ] Settings pages work (email domain display, denylist management, ingestion log)
- [ ] All tests pass (`pnpm test`)
- [ ] Clean deployment to Cloudflare from `main` branch

---

## 7. Relationship to Other Specifications

- **[Focus Reader PRD](../spec/focus-reader-prd.md):** Phase 1 deliverables (Section 7, Phase 1)
- **[Email Newsletter PRD](../spec/email-newsletter-prd.md):** Subscription management (Section 5.2), reader interface (Section 5.3)
- **[Repo Structure Spec](../spec/repo-structure.md):** Monorepo layout, package organization, apps/web structure
- **[Phase 0 Plan](./phase-0-plan.md):** Prerequisites — all Phase 0 deliverables must be complete
- **[Improvements](../spec/improvements.md):** S7 (Administrative Bootstrap via OWNER_EMAIL), S9 (API Key Schema) are addressed in Step 6c
