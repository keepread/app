# Phase 0 Implementation Plan: Email Ingestion Proof of Concept

**Version:** 1.0
**Date:** February 13, 2026
**Status:** Draft
**Prerequisites:** None

---

## 1. Phase 0 Scope

Phase 0 validates that the email ingestion pipeline works end to end — from a newsletter provider sending an email to a parsed, sanitized document stored in D1. There is no UI. Verification is done via D1 database inspection, `wrangler d1 execute` queries, or a minimal health-check API route.

This phase also establishes the monorepo foundation that all subsequent phases build on.

### 1.1 What's In

From the PRD Phase 0 deliverables (Section 7, Phase 0):

- **Monorepo scaffolding** — PNPM workspaces, Turborepo, shared TypeScript config, all root config files, all workspace shells
- **D1 schema** — All tables from the PRD created upfront (avoids mid-flight migrations). Phase 0 actively uses: `Document`, `Document_Email_Meta`, `Subscription`, `Tag`, `Attachment`, `Denylist`, `Ingestion_Log`, `Document_Tags`, `Subscription_Tags`. Tables for later phases (Feed, Highlight, Collection, etc.) are created empty.
- **Email ingestion pipeline** — Cloudflare Email Worker with catch-all, MIME parsing, HTML sanitization, Markdown conversion, deduplication, validation/rejection, confirmation detection, subscription auto-creation, ingestion logging
- **CID inline image persistence** — Upload inline `cid:` image attachments to R2 during ingestion and rewrite HTML references to proxy URLs, so images are preserved for the Phase 1 reader UI
- **Shared types and utilities** — TypeScript types for all Phase 0 entities, email-related constants, slug/time/URL utilities
- **No UI** — verify via database inspection or API call

### 1.2 What's Out (deferred to Phase 1+)

- Web UI (all of it — reader, sidebar, document list, reading pane)
- Article saving via URL paste (Readability extraction)
- Bookmark saving
- API business logic layer (`packages/api`)
- Next.js API route handlers
- Subscription management UI
- Tagging UI
- Document triage UI
- Authentication middleware (Cloudflare Access JWT validation, API keys)
- Any client-side code

---

## 2. Implementation Steps

The plan is organized into 5 sequential steps. Each step builds on the previous and produces a testable, buildable state.

---

### Step 1: Monorepo Scaffolding

**Goal:** A buildable, empty monorepo with all workspaces wired up and passing `pnpm build` / `pnpm typecheck`.

**Deliverables:**

1. **Root config files:**
   - `pnpm-workspace.yaml` — defines `apps/*` and `packages/*`
   - `.npmrc` — `strict-peer-dependencies=true`, `shamefully-hoist=false`
   - `package.json` — root scripts (`build`, `dev`, `test`, `lint`, `typecheck`, `db:migrate`, `clean`), `packageManager` field, `engines`
   - `turbo.json` — task pipeline with `^build` dependencies
   - `tsconfig.base.json` — shared compiler options (ES2022, ESNext modules, bundler resolution, strict, no DOM)
   - `.gitignore` — `node_modules/`, `dist/`, `.next/`, `.wrangler/`, `.dev.vars`, `*.local`

2. **Root scripts:**
   - `scripts/sync-secrets.sh` — Propagates shared configuration variables (`EMAIL_DOMAIN`, `COLLAPSE_PLUS_ALIAS`, etc.) across the multiple `.dev.vars` files in each app workspace, ensuring consistency for local development. Referenced in [Repo Structure Spec](../../reference/repo-structure.md), Section 8.
   - `scripts/ingest-local.ts` — Reads a `.eml` file from disk and replays it against the local email worker's `email()` handler. Accepts a file path argument and optionally a recipient address override. Used for iterative debugging of newsletter parsing/sanitization without requiring actual email delivery. Runs via `npx tsx scripts/ingest-local.ts ./fixtures/substack-example.eml`.

3. **Package workspaces (empty shells with `package.json`, `tsconfig.json`, `src/index.ts`):**
   - `packages/shared` (`@focus-reader/shared`)
   - `packages/db` (`@focus-reader/db`) — depends on `@focus-reader/shared`. Includes a minimal `wrangler.toml` containing only the D1 `database_id` binding, making this package the authoritative location for running `wrangler d1 migrations apply`. No Worker logic — just the migration config.
   - `packages/parser` (`@focus-reader/parser`) — depends on `@focus-reader/shared`
   - `packages/api` (`@focus-reader/api`) — depends on `shared`, `db`, `parser` *(empty shell only — populated in Phase 1)*

4. **App workspaces (empty shells):**
   - `apps/web` — Next.js app with `@cloudflare/next-on-pages`, `wrangler.toml` with D1/R2 bindings *(empty shell only — populated in Phase 1)*
   - `apps/email-worker` — Cloudflare Worker with `wrangler.toml` with D1/R2 bindings and email routing config

5. **Validation:**
   - `pnpm install` succeeds
   - `pnpm build` compiles all packages and apps
   - `pnpm typecheck` passes with zero errors
   - Turbo dependency graph is correct (`turbo run build --dry`)

**Key decisions:**
- Each package uses `tsup` for building (fast, zero-config ESM bundler) with `"main": "dist/index.js"` and `"types": "dist/index.d.ts"` in `package.json`.
- `apps/web` uses Next.js App Router with `@cloudflare/next-on-pages` (scaffolded but not populated until Phase 1).
- `apps/email-worker` uses `wrangler` for building/deploying.
- Vitest is configured at each workspace level but test files come in subsequent steps.
- All workspaces target ES2022. Only `apps/web` adds `"DOM"` to `lib`.

**Files created:**
```
pnpm-workspace.yaml
.npmrc
package.json
turbo.json
tsconfig.base.json
.gitignore
scripts/sync-secrets.sh
scripts/ingest-local.ts
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/index.ts
packages/db/package.json
packages/db/tsconfig.json
packages/db/wrangler.toml
packages/db/src/index.ts
packages/parser/package.json
packages/parser/tsconfig.json
packages/parser/src/index.ts
packages/api/package.json
packages/api/tsconfig.json
packages/api/src/index.ts
apps/web/package.json
apps/web/tsconfig.json
apps/web/next.config.mjs
apps/web/wrangler.toml
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/email-worker/package.json
apps/email-worker/tsconfig.json
apps/email-worker/wrangler.toml
apps/email-worker/src/index.ts
```

---

### Step 2: Shared Package — Types, Constants, Utilities

**Goal:** Populate `packages/shared` with the TypeScript types, constants, and utility functions needed by the email ingestion pipeline.

**Deliverables:**

1. **`src/types.ts`** — TypeScript interfaces/types for **all** entities in the PRD (not just email-specific ones), so the D1 migration can create all tables upfront without mid-flight schema changes:
   - **Core entities (used in Phase 0):** `Document`, `DocumentEmailMeta`, `Subscription`, `Tag`, `Attachment`, `Denylist`, `IngestionLog`
   - **Core entities (created in migration, populated in later phases):** `Feed`, `Highlight`, `Collection`, `DocumentPdfMeta`, `FeedToken`, `ApiKey`, `SavedView`, `UserPreferences`, `IngestionReportDaily`
   - **Join table types:** `DocumentTag`, `SubscriptionTag`, `FeedTag`, `HighlightTag`, `CollectionDocument`
   - **Enum-like union types:**
     - `DocumentType` — `'article' | 'pdf' | 'email' | 'rss' | 'bookmark' | 'post'`
     - `DocumentLocation` — `'inbox' | 'later' | 'archive'`
     - `OriginType` — `'subscription' | 'feed' | 'manual'` (on `Document.origin_type`)
     - `ChannelType` — `'email' | 'rss' | 'api' | 'extension'` (on `IngestionLog.channel_type`)
     - `IngestionStatus` — `'success' | 'failure'`
   - **Input types:** `CreateDocumentInput`, `CreateEmailMetaInput`, `CreateSubscriptionInput`, `CreateIngestionLogInput`, `CreateAttachmentInput`, `CreateDenylistInput`, `CreateTagInput`

2. **`src/constants.ts`** — Enums and defaults:
   - `DOCUMENT_TYPES`, `DOCUMENT_LOCATIONS`, `ORIGIN_TYPES`, `CHANNEL_TYPES`, `INGESTION_STATUSES`
   - `DEFAULT_PAGE_SIZE = 50`
   - `MAX_RETRY_ATTEMPTS = 3`
   - `TRACKER_DOMAINS` — list of known email tracking pixel domains (e.g., `list-manage.com`, `doubleclick.net`, `mailchimp.com/track`, `open.substack.com`) used by the sanitizer to strip tracking images. Provides a functional baseline for Phase 0; can be extended in later phases.

3. **`src/url.ts`** — URL normalization:
   - `normalizeUrl(url: string): string` — strip `utm_*`, `fbclid`, `gclid`, trailing slashes, `www.` prefix, sort query params
   - `extractDomain(url: string): string`

4. **`src/slug.ts`** — Slug/display name utilities:
   - `slugToDisplayName(slug: string): string` — `morning-brew` -> `Morning Brew`
   - `emailToSubscriptionKey(email: string, collapsePlus: boolean): string`

5. **`src/time.ts`** — Time utilities:
   - `estimateReadingTime(wordCount: number): number`
   - `countWords(text: string): number`
   - `nowISO(): string`
   - `dateBucket(date: Date): string` — hour-level UTC bucket for fingerprinting

6. **`src/index.ts`** — barrel export

7. **Tests:** Unit tests for `url.ts`, `slug.ts`, `time.ts` using Vitest.

> **Note:** The full set of types is defined here (not just the email-specific ones) so that the D1 migration can create all tables upfront. This avoids a schema migration between Phase 0 and Phase 1. API request/response types (`ListDocumentsQuery`, `PaginatedResponse<T>`, etc.) are deferred to Phase 1 when the API layer is built.

---

### Step 3: Database Package — Schema and Query Helpers

**Goal:** Populate `packages/db` with the D1 migration and typed query helpers needed by the email ingestion pipeline.

**Deliverables:**

1. **`migrations/0001_initial_schema.sql`** — Single migration creating **all** tables from the PRD (including those used in later phases, to avoid mid-flight migrations):

   **Tables used in Phase 0 (email ingestion):**
   - `document` — all fields with indexes on `location`, `type`, `source_id`, `is_read`, `is_starred`, `saved_at`, `deleted_at`. Uses `origin_type` (not `source_type`) per improvements.md #16.
   - `document_email_meta` — with unique indexes on `message_id` and `fingerprint`
   - `subscription` — with unique index on `pseudo_email`
   - `tag` — with unique index on `name`
   - `attachment` — with index on `document_id`
   - `denylist` — with unique index on `domain`
   - `ingestion_log` — with indexes on `document_id`, `channel_type`, `status`, `received_at`. Uses `channel_type` (not `source_type`) per improvements.md #16.
   - `document_tags` — composite PK
   - `subscription_tags` — composite PK

   **Tables created now but populated in later phases:**
   - `feed` — with unique index on `feed_url`. Includes `fetch_full_content` field (improvements.md #10).
   - `document_pdf_meta` — FK to `document`
   - `highlight` — with index on `document_id`
   - `collection` — **without** `is_public` (removed per improvements.md #14; conflicts with security model)
   - `feed_token` — with unique index on `token_hash`
   - `api_key` — with unique index on `key_hash` (improvements.md #9)
   - `saved_view` — for persisted filtered views (improvements.md #11)
   - `user_preferences` — single-row settings store with `schema_version` (improvements.md #12)
   - `ingestion_report_daily` — PK on `report_date` (improvements.md #13)
   - `feed_tags` — composite PK
   - `highlight_tags` — composite PK
   - `collection_documents` — composite PK with `sort_order`

   **Schema conventions:**
   - All tables use `TEXT` for UUIDs, ISO 8601 strings for timestamps
   - `CHECK` constraints on enum fields: `document.type`, `document.location`, `document.origin_type`, `ingestion_log.channel_type`, `ingestion_log.status`

2. **`src/schema.ts`** — Table and column name constants (prevents typo-based SQL bugs).

3. **`src/queries/documents.ts`** — Query functions needed by the email worker:
   - `createDocument(db: D1Database, doc: CreateDocumentInput): Promise<Document>`
   - `getDocument(db: D1Database, id: string): Promise<Document | null>`
   - `updateDocument(db: D1Database, id: string, updates: Partial<Document>): Promise<Document>`
   - `getDocumentByUrl(db: D1Database, url: string): Promise<Document | null>`

4. **`src/queries/email-meta.ts`:**
   - `createEmailMeta(db, meta: CreateEmailMetaInput): Promise<DocumentEmailMeta>`
   - `getEmailMetaByMessageId(db, messageId: string): Promise<DocumentEmailMeta | null>`
   - `getEmailMetaByFingerprint(db, fingerprint: string): Promise<DocumentEmailMeta | null>`
   - `incrementDeliveryAttempts(db, documentId: string): Promise<void>`

5. **`src/queries/subscriptions.ts`:**
   - `createSubscription(db, sub: CreateSubscriptionInput): Promise<Subscription>`
   - `getSubscriptionByEmail(db, pseudoEmail: string): Promise<Subscription | null>`

6. **`src/queries/tags.ts`:**
   - `createTag(db, tag: CreateTagInput): Promise<Tag>`
   - `getTagsForSubscription(db, subscriptionId: string): Promise<Tag[]>`
   - `addTagToDocument(db, documentId: string, tagId: string): Promise<void>`

7. **`src/queries/ingestion-log.ts`:**
   - `logIngestionEvent(db, event: CreateIngestionLogInput): Promise<void>`

8. **`src/queries/denylist.ts`:**
   - `isDomainDenied(db, domain: string): Promise<boolean>`

9. **`src/queries/attachments.ts`:**
   - `createAttachment(db, att: CreateAttachmentInput): Promise<Attachment>`

10. **`src/index.ts`** — barrel export

11. **Tests:** Query tests using `@cloudflare/vitest-pool-workers` (miniflare) with a real D1 binding. Test each query module with fixture data.

12. **Schema-type drift test:** A test that runs the migration against a fresh D1 instance, introspects the resulting table structure via `PRAGMA table_info(...)`, and compares column names and types against the TypeScript interfaces in `@focus-reader/shared`. This catches manual drift between the SQL migration and the TS types without requiring a codegen tool.

> **Note:** Query helpers for `listDocuments`, `softDeleteDocument`, `listSubscriptions`, `listTags`, `listDenylist`, etc. are deferred to Phase 1 when the API/UI needs them. Only the queries required by the email worker are implemented here.

---

### Step 4: Parser Package — Email Parsing and Sanitization

**Goal:** Populate `packages/parser` with email parsing, HTML sanitization, and Markdown conversion. All code must run in the Cloudflare Workers runtime.

**Deliverables:**

1. **`src/sanitize.ts`** — HTML sanitization using DOMPurify + linkedom:
   - `sanitizeHtml(html: string): string` — remove tracking pixels (1x1 images, domains matching `TRACKER_DOMAINS` from `@focus-reader/shared`), strip `<script>`, `<style>`, `on*` attributes, external scripts. Preserve layout, images, and inline styles.
   - `rewriteCidUrls(html: string, documentId: string, cidMap: Map<string, string>): string` — replace `src="cid:..."` references in sanitized HTML with proxy URLs (`/api/attachments/{documentId}/{contentId}`). Called after sanitization but before storage. The proxy endpoint is implemented in Phase 1 with the web app; the URLs are stable and predictable.
   - Export a configured DOMPurify instance.

2. **`src/markdown.ts`** — HTML to Markdown using Turndown:
   - `htmlToMarkdown(html: string): string` — convert sanitized HTML to Markdown.
   - Configure Turndown rules for tables, code blocks, images.

3. **`src/email/parse.ts`** — MIME parsing using `postal-mime`:
   - `parseEmail(rawStream: ReadableStream): Promise<ParsedEmail>` — extract subject, from (address + name), date, HTML body, plain text body, headers, attachments.
   - `ParsedEmail` type: `{ subject, fromAddress, fromName, date, htmlBody, plainTextBody, headers, attachments[] }`

4. **`src/email/dedup.ts`** — Deduplication:
   - `extractMessageId(headers: Record<string, string>): string | null` — normalize Message-ID.
   - `computeFingerprint(recipient: string, fromAddress: string, subject: string, date: Date, bodyHash: string): string` — SHA-256 hash of concatenated fields with hour-level date bucket.

5. **`src/email/validate.ts`** — Validation and rejection:
   - `validateEmail(parsed: ParsedEmail, deniedDomains: string[]): ValidationResult` — returns `{ isRejected: boolean, rejectionReason: string | null }`.
   - Rules: empty body, sender domain in denylist.

6. **`src/email/confirm.ts`** — Confirmation detection:
   - `isConfirmationEmail(parsed: ParsedEmail): boolean` — detect by subject keywords, known sender patterns, CTA link patterns.

7. **`src/email/index.ts`** — barrel export for email submodule.

8. **`src/attachments.ts`** — Attachment extraction:
   - `extractAttachmentMeta(mimeAttachments: PostalMimeAttachment[]): AttachmentMeta[]` — map MIME parts to metadata records.
   - `extractCidAttachments(mimeAttachments: PostalMimeAttachment[]): CidAttachment[]` — filter and return only inline attachments that have a `contentId` (i.e., `cid:` images). Returns the content buffer, content type, and content ID for each. Used by the email worker to upload these to R2.

9. **`src/index.ts`** — barrel export.

10. **Tests:**
    - Email parsing tests with fixture `.eml` files (real newsletters from Substack, Buttondown, Mailchimp).
    - Deduplication tests (with/without Message-ID, fingerprint collision scenarios).
    - Validation tests (empty body, denylist match, clean pass).
    - Confirmation detection tests.
    - Sanitization tests (tracking pixel removal, script stripping, image preservation).
    - CID URL rewriting tests (verify `cid:` references are replaced with proxy URLs, non-CID images are untouched).
    - CID attachment extraction tests (inline images extracted, regular attachments excluded).
    - Markdown conversion tests.

> **Note:** Article extraction (`src/article/`) is deferred to Phase 1. Only email parsing and shared sanitization/markdown utilities are implemented here.

---

### Step 5: Email Worker

**Goal:** A fully functional Cloudflare Email Worker that receives inbound email and writes documents to D1 using `@focus-reader/parser` and `@focus-reader/db`.

**Deliverables:**

1. **`apps/email-worker/src/index.ts`** — the `email()` handler:
   - Accept the inbound `EmailMessage` event.
   - Extract recipient address, determine subscription key.
   - Parse MIME content via `@focus-reader/parser` email parser.
   - Check deduplication (Message-ID, then fingerprint) via `@focus-reader/db` queries.
   - If duplicate: increment `delivery_attempts`, update `updated_at`, log, return.
   - Validate (empty body, denylist) via `@focus-reader/parser` validator.
   - Check confirmation via `@focus-reader/parser` confirm detector.
   - Sanitize HTML via `@focus-reader/parser`.
   - **Upload CID inline images to R2:** Extract inline `cid:` attachments via `extractCidAttachments()`. For each, upload to R2 at key `attachments/{documentId}/{contentId}` via `env.FOCUS_STORAGE.put()`. Build a `cidMap` (contentId → storageKey). If an individual R2 upload fails, log a warning and continue — the document is still stored with a broken image reference rather than failing the entire ingestion.
   - **Rewrite CID references:** Call `rewriteCidUrls()` on the sanitized HTML to replace `src="cid:..."` with `/api/attachments/{documentId}/{contentId}` proxy URLs.
   - Convert rewritten HTML to Markdown via `@focus-reader/parser`.
   - Compute word count and reading time via `@focus-reader/shared`.
   - Look up or auto-create `Subscription` via `@focus-reader/db`.
   - Create `Document` (type=email, origin_type=subscription, location=inbox) and `Document_Email_Meta` in a D1 batch. The `html_content` stored is the sanitized, CID-rewritten version.
   - Create `Attachment` records for all MIME attachments. CID attachments have `storage_key` populated with the R2 key; non-CID attachments remain metadata-only (`storage_key = null`).
   - Inherit subscription tags: copy `Subscription_Tags` entries to `Document_Tags`.
   - Log ingestion event to `Ingestion_Log`.
   - Wrap database writes in retry logic (3 attempts, exponential backoff).

2. **`apps/email-worker/wrangler.toml`:**
   - D1 binding: `FOCUS_DB`
   - R2 binding: `FOCUS_STORAGE` (used for CID inline image storage)
   - Email routing configuration
   - Environment variable: `EMAIL_DOMAIN`
   - Environment variable: `COLLAPSE_PLUS_ALIAS` (default: false)

3. **Tests:** Integration tests using `@cloudflare/vitest-pool-workers`:
   - End-to-end: feed a raw email stream -> verify Document + EmailMeta + Subscription + IngestionLog in D1.
   - CID image persistence: email with inline `cid:` images -> verify images uploaded to R2, HTML `src` attributes rewritten to proxy URLs, `Attachment` records have `storage_key` populated.
   - CID upload failure resilience: simulate R2 failure -> verify document is still created (with broken image refs), failure logged.
   - Deduplication: send same email twice -> verify single document, `delivery_attempts = 2`.
   - Rejection: empty body email -> verify `is_rejected = 1`.
   - Confirmation: verification email -> verify `needs_confirmation = 1`.
   - Auto-create subscription: first email to a new address -> verify subscription created.
   - Tag inheritance: subscription with tags -> document inherits tags.

4. **Manual validation:** Deploy to Cloudflare, subscribe to 3 real newsletters, verify receipt and parsing via D1 console (`wrangler d1 execute`).

---

## 3. Dependency Order

```
Step 1: Monorepo Scaffolding
    └── Step 2: packages/shared (types, constants, utils)
        ├── Step 3: packages/db (schema, migrations, queries)
        └── Step 4: packages/parser (email parsing, sanitize, markdown)
            └── Step 5: apps/email-worker (ties it all together)
```

Steps 3 and 4 can be parallelized since both depend only on `packages/shared`.

---

## 4. Local Development Workflow

```bash
# First-time setup: sync local secrets
./scripts/sync-secrets.sh

# Terminal 1: Start the email worker
pnpm --filter apps/email-worker dev

# This starts:
#   - apps/email-worker: wrangler dev (Email Worker on port 8787)
#   - D1/R2 state persisted to .wrangler/state

# Terminal 2: Run tests
pnpm test                                # All tests
pnpm --filter @focus-reader/parser test  # Just parser tests
pnpm --filter @focus-reader/db test      # Just db tests

# Apply migrations to local D1 (from the authoritative packages/db)
pnpm db:migrate

# Replay a specific .eml file against the local worker
npx tsx scripts/ingest-local.ts ./fixtures/substack-example.eml
npx tsx scripts/ingest-local.ts ./fixtures/nyt-morning.eml --recipient nyt@read.example.com

# Inspect local D1 data after receiving test emails
pnpm --filter apps/email-worker exec -- wrangler d1 execute FOCUS_DB --local --command "SELECT id, title, type FROM document ORDER BY saved_at DESC LIMIT 10"
```

**Local email testing:** Use `scripts/ingest-local.ts` to replay `.eml` fixture files against the local worker — this is the primary debugging workflow for testing how specific newsletter layouts are sanitized and rewritten. For live testing, use `wrangler email` CLI or send real emails to the catch-all domain. Integration tests also use fixture `.eml` files directly.

---

## 5. Deployment Checklist

Before deploying Phase 0 to production:

1. **DNS configuration:**
   - MX record for `read.yourdomain.com` pointing to Cloudflare's email routing
   - SPF, DKIM, DMARC records configured
   - Cloudflare Email Routing catch-all rule for the subdomain

2. **Cloudflare resources:**
   - D1 database created (`focus-reader-db`)
   - R2 bucket created (`focus-reader-storage`)
   - Database ID added to `packages/db/wrangler.toml` (authoritative migration config) and `apps/email-worker/wrangler.toml`

3. **Secrets:**
   - `OWNER_EMAIL` set via `wrangler secret put` for `apps/email-worker`
   - `EMAIL_DOMAIN` set in `wrangler.toml` `[vars]` for `apps/email-worker`

4. **Deploy:**
   - Run migrations from the authoritative location: `cd packages/db && wrangler d1 migrations apply FOCUS_DB --remote`
   - Deploy email worker: `cd apps/email-worker && wrangler deploy`

5. **Validation:**
   - Subscribe to 3 real newsletters (e.g., Substack, Buttondown, Mailchimp) using generated pseudo emails
   - Wait for first emails to arrive
   - Verify via D1 console:
     - `SELECT COUNT(*) FROM document WHERE type = 'email'` — should be ≥ 3
     - `SELECT * FROM subscription` — should show auto-created subscriptions
     - `SELECT * FROM ingestion_log WHERE status = 'success'` — should match document count
   - Inspect HTML and Markdown content quality for each newsletter
   - Verify CID images: for newsletters with inline images, check R2 bucket contains objects under `attachments/` prefix and HTML content has `/api/attachments/` URLs instead of `cid:` references
   - Verify deduplication: trigger a re-send and check `delivery_attempts` increments
   - Verify rejection: add a domain to denylist, send email from that domain, check `is_rejected = 1`

---

## 6. Success Criteria

Phase 0 is complete when:

- [ ] Monorepo builds and typechecks cleanly (`pnpm build && pnpm typecheck`)
- [ ] All unit and integration tests pass (`pnpm test`)
- [ ] Email Worker is deployed to Cloudflare and receiving emails
- [ ] Emails from at least 3 different newsletter platforms (e.g., Substack, Buttondown, Mailchimp) are successfully received, parsed, and stored
- [ ] Stored documents have clean sanitized HTML and valid Markdown conversion
- [ ] Inline `cid:` images are uploaded to R2 and HTML references are rewritten to proxy URLs
- [ ] Deduplication works (duplicate emails do not create new documents)
- [ ] Validation works (empty body emails are flagged as rejected)
- [ ] Confirmation detection works (verification emails are flagged with `needs_confirmation`)
- [ ] Subscriptions are auto-created on first email to a new address
- [ ] Ingestion log records all attempts with correct status

---

## 7. What Phase 1 Will Add

Phase 0 establishes the data layer and email pipeline. Phase 1 builds on it by adding:

- **`packages/api`** — Business logic for documents, subscriptions, tags, auth
- **Attachment proxy endpoint** — `GET /api/attachments/:documentId/:contentId` to serve CID images from R2 (the images are already stored by Phase 0; Phase 1 adds the serving endpoint)
- **`packages/parser` additions** — Article extraction (`src/article/`), metadata extraction for URL saves
- **`packages/db` additions** — List/filter/paginate queries, subscription stats, tag CRUD, denylist CRUD
- **`apps/web`** — Full Next.js app: API routes, three-pane reader UI, subscription management, tagging, triage, focus mode, responsive layout
- **Authentication** — Cloudflare Access JWT validation, API key support

See [Phase 1 Plan](./phase-1-plan.md) for full details.

---

## 8. Relationship to Other Specifications

- **[Focus Reader PRD](../specs/focus-reader-prd-v1.md):** Phase 0 deliverables (Section 7, Phase 0)
- **[Email Newsletter PRD](../specs/email-newsletter-prd-v1.md):** Email ingestion pipeline (Section 5.1), email addressing strategy (Section 3.3), deduplication (Section 5.1), validation (Section 5.1)
- **[Repo Structure Spec](../../reference/repo-structure.md):** Monorepo layout, PNPM workspaces, Turborepo config, package organization
