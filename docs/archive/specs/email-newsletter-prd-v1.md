# Product Requirements Document: Focus Reader

**Version:** 1.0
**Date:** February 11, 2026
**Status:** Draft

---

## 1. Overview

### 1.1 Problem Statement

Email newsletters are a valuable source of curated information, but subscribing to them clutters the inbox and mixes long-form reading content with actionable correspondence. There is no clean separation between "things to read" and "things to act on" in a typical email workflow.

### 1.2 Product Vision

**Focus Reader** is a self-hosted system that provides a dedicated ingestion pipeline for email newsletters using pseudo email addresses, converts them into clean readable formats (HTML and Markdown), and presents them in an RSS-reader-like interface with support for tagging, categorization, and search.

> **Definition of "self-hosted":** The application can be deployed in single-user mode to an individual's own Cloudflare account, or operated as a multi-tenant SaaS where multiple users share the same D1 database with row-level data isolation. In both modes, all email newsletter data is scoped to the owning user.

### 1.3 Goals

- Eliminate newsletter clutter from the user's primary inbox.
- Provide a dedicated, distraction-free reading experience for newsletters.
- Allow the user to generate unlimited pseudo email addresses for subscriptions.
- Support an existing tagging/categorization system for organizing content.
- Optionally expose ingested newsletters as RSS/Atom feeds for interoperability with other readers.

### 1.4 Non-Goals

- This is not a general-purpose email client.
- ~~This is not a collaborative or multi-tenant SaaS product.~~ Multi-tenancy is now supported with row-level user isolation. Each user's subscriptions, documents, and settings are fully independent.
- This does not handle transactional or marketing email beyond newsletters.
- This does not provide email sending capabilities.

---

## 2. Target User

In single-user mode, a self-hosting power user. In multi-tenant mode, multiple independent users. The typical user subscribes to many email newsletters, values organized reading workflows, and wants a dedicated reading interface separate from their inbox.

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Newsletter     │     │   Ingestion      │     │   Storage        │
│   Provider       │────▶│   Pipeline       │────▶│   Layer          │
│   (sends email)  │     │   (Email Worker) │     │   (Database)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
                                                   ┌──────────────────┐
                                                   │   Reader UI      │
                                                   │   (Web App)      │
                                                   └──────────────────┘
                                                           │
                                                           ▼
                                                   ┌──────────────────┐
                                                   │   RSS/Atom Feed  │
                                                   │   (Optional)     │
                                                   └──────────────────┘
```

### 3.2 Stack

| Layer             | Technology                  | Rationale                                                                                            |
|-------------------|-----------------------------|------------------------------------------------------------------------------------------------------|
| Email Ingestion   | Cloudflare Email Workers    | Zero server management, programmable hooks on inbound email, free at personal scale                  |
| Database          | Cloudflare D1 (SQLite)      | D1 for all-Cloudflare stack                                                                          |
| Web UI            | Next.js on Cloudflare Pages | Rich ecosystem, API routes, deployed via `@cloudflare/next-on-pages`                                 |
| Email Parsing     | `postal-mime`               | Works natively in Workers (no Node.js APIs). Used in Cloudflare's own examples                       |
| HTML → Markdown   | Turndown                    | Well-maintained HTML-to-Markdown conversion library                                                  |
| HTML Sanitization | DOMPurify + `linkedom`      | DOMPurify is the gold standard; `linkedom` provides the DOM shim needed in Workers                   |
| Authentication    | Cloudflare Access           | Zero-trust, no auth code to write, free for up to 50 users, supports email OTP / GitHub / Google SSO |

### 3.3 Email Addressing Strategy

Use a **catch-all configuration on a dedicated subdomain** (e.g., `*@read.yourdomain.com`).

- Each newsletter subscription gets a unique address: `techweekly@read.yourdomain.com`, `morning-brew@read.yourdomain.com`.
- The local part (before `@`) implicitly identifies the subscription.
- No pre-configuration needed — any new address auto-creates a subscription on first email received.
- Optionally support `+` subaddressing for additional metadata: `tech+ai@read.yourdomain.com`. The suffix after `+` can be used to tag the type of subscriptions.
- The domain is configured via an environment variable (`EMAIL_DOMAIN`) in `wrangler.toml`, keeping the code portable and domain-agnostic.

**Normalization and routing rules:**

- Recipient matching is case-insensitive.
- The canonical subscription key is the full local part by default (e.g., `tech` and `tech+ai` are treated as different subscriptions).
- Optional plus-alias collapsing (`tech+ai` → `tech`) is configurable via `COLLAPSE_PLUS_ALIAS=false` (default: off).
- Auto-created subscription `display_name` is the slug-decoded local part with separators (`-`, `_`, `+`) converted to spaces (e.g., `morning-brew` → `morning brew`).

---

## 4. Data Model

> **Canonical schema:** The authoritative database schema for Focus Reader is defined in the [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5. Email newsletter items are stored using the unified `Document` + `Document_Email_Meta` tables defined there. This section describes how email-specific concepts map to that unified model and documents the email-specific behavioral details that the main PRD references.

### 4.0 Terminology Glossary

- **Document:** The universal content entity in Focus Reader. Each ingested newsletter email is stored as a `Document` row with `type = 'email'` and `origin_type = 'subscription'`. See [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1.
- **Document_Email_Meta:** A companion table storing email-specific metadata (deduplication keys, sender details, rejection/confirmation flags) for documents with `type = 'email'`. One-to-one with `Document`.
- **Subscription:** A newsletter source mapped to one pseudo email address (e.g., `techweekly@read.yourdomain.com`). Documents reference their subscription via `Document.source_id`.
- **Tag:** A user-defined label used to organize subscriptions and documents.
- **Attachment:** Metadata for a file or inline MIME part associated with a document.
- **Ingestion event:** One processing attempt for an inbound email, recorded in `Ingestion_Log`.

### 4.1 Schema Mapping

> **Note:** The full table definitions for all entities below live in the [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5. This section explains how email-specific concepts from this spec map to that unified schema.

#### How Newsletter Items Map to the Unified Model

The original `Newsletter_Item` entity from this spec has been replaced by two tables in the unified model:

1. **`Document`** — stores the universal fields (content, metadata, reading state).
2. **`Document_Email_Meta`** — stores email-specific fields (deduplication keys, sender details, rejection/confirmation flags).

Each ingested newsletter email creates one `Document` row (with `type = 'email'`, `origin_type = 'subscription'`) and one `Document_Email_Meta` row linked by `document_id`.

**Field mapping from the original `Newsletter_Item` to the unified model:**

| Original `Newsletter_Item` field | Unified table            | Unified field         | Notes                                          |
|----------------------------------|--------------------------|-----------------------|------------------------------------------------|
| `id`                             | `Document`               | `id`                  |                                                |
| `subscription_id`                | `Document`               | `source_id`           | With `origin_type = 'subscription'`            |
| `message_id`                     | `Document_Email_Meta`    | `message_id`          |                                                |
| `fingerprint`                    | `Document_Email_Meta`    | `fingerprint`         |                                                |
| `subject`                        | `Document`               | `title`               |                                                |
| `from_address`                   | `Document_Email_Meta`    | `from_address`        |                                                |
| `from_name`                      | `Document_Email_Meta`    | `from_name`           | Also stored as `Document.author`               |
| `received_at`                    | `Document`               | `saved_at`            |                                                |
| `html_content`                   | `Document`               | `html_content`        |                                                |
| `markdown_content`               | `Document`               | `markdown_content`    |                                                |
| `plain_text_content`             | `Document`               | `plain_text_content`  |                                                |
| `raw_headers`                    | `Document_Email_Meta`    | `raw_headers`         |                                                |
| `is_read`                        | `Document`               | `is_read`             |                                                |
| `is_starred`                     | `Document`               | `is_starred`          |                                                |
| `is_rejected`                    | `Document_Email_Meta`    | `is_rejected`         |                                                |
| `rejection_reason`               | `Document_Email_Meta`    | `rejection_reason`    |                                                |
| `needs_confirmation`             | `Document_Email_Meta`    | `needs_confirmation`  |                                                |
| `delivery_attempts`              | `Document_Email_Meta`    | `delivery_attempts`   |                                                |
| `updated_at`                     | `Document`               | `updated_at`          |                                                |
| `summary`                        | *(not in unified model)* | —                     | Future: may be added to `Document` in Phase 4  |

#### Other Entity Mappings

- **Subscription:** Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1. Schema is unchanged from this spec. Documents reference their subscription via `Document.source_id` (instead of the original `subscription_id` FK).
- **Tag:** Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1. Schema is unchanged.
- **Attachment:** Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1. The FK is now `document_id` (was `newsletter_item_id`).
- **Denylist:** Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1. Schema is unchanged.
- **Feed_Token:** Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1. Schema is unchanged.
- **Ingestion_Log:** Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.1. The FK is now `document_id` (was `newsletter_item_id`) and a `channel_type` field has been added to distinguish email ingestion events from RSS, API, and extension events.

#### Join Tables

- **Subscription_Tags:** Unchanged. Defined in [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.2.
- **Newsletter_Item_Tags → Document_Tags:** The original `Newsletter_Item_Tags` join table has been replaced by `Document_Tags` in the unified model, which associates tags with any document type. See [Focus Reader PRD](./focus-reader-prd-v1.md), Section 5.2.

---

## 5. Feature Specifications

### 5.1 Email Ingestion Pipeline

**Priority:** P0 (Critical)

**Description:** Receive inbound emails at pseudo addresses, parse them, and store them as documents.

**Functional Requirements:**

- Accept inbound email on any address at the configured subdomain (catch-all).
- Parse MIME content to extract: subject, sender, date, HTML body, plain text body, and headers.
- Sanitize HTML body: remove tracking pixels, external scripts, and unsafe elements. Preserve layout and images.
- Convert sanitized HTML to Markdown.
- If no matching subscription exists for the recipient address, auto-create one using the local part as the display name and the sender info from the email.
- Create a `Document` record with `type = 'email'`, `origin_type = 'subscription'`, and `location = 'inbox'`, linked to the subscription via `source_id`. Create a corresponding `Document_Email_Meta` record with email-specific fields (deduplication keys, sender details, headers).
- Extract attachment metadata from MIME parts and store in the `Attachment` table (linked via `document_id`). For inline `cid:` image attachments, upload the binary to R2 (key: `attachments/{document_id}/{content_id}`), populate `storage_key`, and rewrite `cid:` references in the stored HTML to proxy URLs (`/api/attachments/{document_id}/{content_id}`). Non-inline attachments remain metadata-only in v1 (`storage_key` is null).
- The `/api/attachments/` proxy endpoint that serves CID images from R2 is implemented in Phase 1 with the web app.
- Log every ingestion attempt in the `Ingestion_Log` table with `event_id`, `document_id`, `channel_type = 'email'`, `received_at`, `status`, `error_code`, `error_detail`, and `attempts`.

**Deduplication:**

- Primary deduplication key is the normalized `Message-ID` header (stored in `Document_Email_Meta.message_id`).
- If `Message-ID` is missing, compute a fallback `fingerprint`: hash of `recipient + from_address + subject + date_bucket + body_hash`, where `date_bucket` is hour-level UTC (stored in `Document_Email_Meta.fingerprint`).
- Duplicate arrivals do not create a new document; they update `Document.updated_at` on the existing document and increment `Document_Email_Meta.delivery_attempts`.

**Validation and Rejection:**

- `Document_Email_Meta.is_rejected` is set only when at least one explicit rule matches. v1 rejection rules:
  - Empty body (no HTML, no plain text after trimming).
  - Sender domain matches an entry in the `Denylist` table (managed via a settings page in the UI).
  - Known spam template match with confidence ≥ configured threshold.
- Rejected documents are hidden from the default feed view but accessible via a dedicated "Rejected" view. The user can restore a rejected document to the normal feed.

**Confirmation Email Detection:**

- Confirmation/verification emails are **not** rejected. They are stored with `Document_Email_Meta.needs_confirmation = 1`.
- Detection signals: subject keywords (`confirm`, `verify`, `activate`), known sender patterns, and presence of high-confidence confirmation CTA links.
- The UI exposes a "Needs Confirmation" filter and renders confirmation links with a safe target preview before opening.

**Retry Policy:**

- Up to 3 inline retry attempts with exponential backoff within the same Worker invocation for transient failures (e.g., D1 write errors). No external queue or Cron-based retry.
- `success`: parsed, sanitized, and stored without error.
- `failure`: any step fails after retries are exhausted. Logged with `status = failure` plus `error_code` and `error_detail`.

**Edge Cases:**

- Multipart emails with both HTML and plain text: prefer HTML, store both (in `Document.html_content` and `Document.plain_text_content`).
- Emails with attachments: store attachment metadata in the `Attachment` table (linked via `document_id`). Inline `cid:` images are uploaded to R2 and their HTML references rewritten to proxy URLs during ingestion; `content_id` and `storage_key` are populated. Regular attachments have `content_id = null` and `storage_key = null`.

### 5.2 Subscription Management

**Priority:** P0 (Critical)

**Description:** Allow the user to view, edit, organize, and manage their newsletter subscriptions.

**Functional Requirements:**

- List all subscriptions with: display name, pseudo email, sender, tag(s), last received date, unread count.
- Create a new subscription manually (generate a pseudo email address).
- Edit subscription: rename, assign/remove tags, toggle active/inactive.
- Copy pseudo email address to clipboard (for pasting into newsletter signup forms).
- Show subscription stats: total documents received, frequency, last received.

**Deletion semantics:**

- Deleting a subscription is a soft delete by default (`deleted_at` timestamp set, hidden from UI).
- Soft-deleted subscriptions can be restored manually at any time (no expiry). There is no automated cleanup job.
- An explicit hard-delete action permanently removes the subscription, its associated documents (and their `Document_Email_Meta` records), tag links, and attachment metadata.

### 5.3 Reader Interface

**Priority:** P0 (Critical)

**Description:** An RSS-reader-style web interface for browsing and reading newsletters.

**Functional Requirements:**

- **Left sidebar:** List of subscriptions, grouped by tags/folders. Show unread counts. Include an "All" view, a "Starred" view, a "Needs Confirmation" filter, and a "Rejected" view.
- **Feed view (center pane):** Chronological list of documents for the selected subscription, tag, or "All". Show title, sender, date, preview snippet, read/unread status. Pagination: 50 documents per page with "Load more".
- **Reading pane (right or expanded):** Render the sanitized HTML content of the selected document. Toggle between HTML and Markdown views.
- Mark documents as read/unread. Opening a document auto-marks it as read after 1.5 seconds of focused visibility (in both three-pane and Focus Mode layouts); manual toggle remains available.
- Star/bookmark documents.
- Keyboard navigation: `j`/`k` for next/previous document, `s` to star, `m` to toggle read. Keyboard shortcuts are disabled while focus is inside editable inputs.
- Responsive design: desktop default is three-pane layout; mobile default is stacked navigation (list → feed → reader).
- Focus mode: Reading view that makes the content from the reading pane full-width and hides distractions.

### 5.4 Tagging System

**Priority:** P1 (High)

**Description:** Flexible tagging for organizing subscriptions and individual documents.

**Functional Requirements:**

- Create, edit, delete tags with name and color.
- Assign multiple tags to a subscription (all future documents from that subscription inherit these tags via `Subscription_Tags`).
- Assign additional tags to individual documents (via `Document_Tags`).
- Filter the feed view by one or more tags.
- Auto-tagging rules: define rules per subscription or globally based on sender domain, subject keywords, or content keywords.
- Optional: LLM-based auto-tagging — on ingestion, classify the document against the existing tag taxonomy and suggest/apply tags.

### 5.5 Search

**Priority:** P1 (High)

**Description:** Full-text search across all stored newsletters.

**Functional Requirements:**

- Search by: title (subject), sender, body content, tags.
- Filter results by: subscription, tag, date range, read/unread status.
- Return results ranked by relevance with highlighted snippets.

**Implementation:**

- Search (including D1/SQLite FTS5 indexing) is introduced in Phase 2.
- FTS5 indexed fields: `Document.title`, `Document.author`, `Document_Email_Meta.from_address`, `Document.plain_text_content`, `Document.markdown_content`, and tag names.
- FTS index updates are part of the ingestion transaction; failures must roll back the document insert to maintain index consistency.

### 5.6 Summarization (Optional / Future)

**Priority:** P3 (Low)

**Description:** LLM-generated summaries of email documents for quick scanning.

**Functional Requirements:**

- On ingestion (or on demand), generate a 2–3 sentence summary of each document.
- Display summaries in the feed view as an alternative to content previews.
- Generate daily/weekly digest summaries across all or tagged subscriptions.

### 5.7 RSS/Atom Feed Output

**Priority:** P4 (low)

**Description:** Expose ingested newsletters as standard RSS/Atom feeds for consumption in external readers.

**Functional Requirements:**

- Generate an Atom feed per subscription (`/feeds/{subscription-id}/atom.xml`).
- Generate an Atom feed per tag (`/feeds/tags/{tag-name}/atom.xml`).
- Generate a combined "all" feed (`/feeds/all/atom.xml`).
- Feed endpoints are served on a separate route/hostname (for example, `feeds.read.yourdomain.com`) that is not protected by Cloudflare Access, so external RSS clients can fetch feeds.
- Feeds are authenticated by a per-user opaque token in the URL. Tokens are stored hashed (SHA-256) in the `Feed_Token` table; plaintext is never persisted.
- Token lifecycle: the UI supports creating, rotating, and revoking feed tokens.
- Feed items include: title (`Document.title`), content (`Document.html_content`), author (`Document.author`), published date (`Document.saved_at`).

---

## 6. Phased Rollout

### Phase 0 — Proof of Concept

**Goal:** Validate that the email ingestion pipeline works end to end.

**Deliverables:**

- Cloudflare Email Worker configured with catch-all on subdomain.
- Worker parses inbound email and writes to D1.
- No UI — verify via database inspection or API call.
- Subscribe to 2–3 real newsletters and confirm receipt and parsing.

**Success Criteria:** Emails from at least 3 different newsletter platforms are successfully received, parsed, and stored with clean HTML extraction.

### Phase 1 — Minimal Viable Reader

**Goal:** A functional reader for browsing stored newsletters.

**Deliverables:**

- Web UI with sidebar (subscriptions list), feed view, and reading pane.
- Subscription management: view, rename, copy email address.
- Basic tagging: create tags, assign to subscriptions.
- Mark read/unread, star documents.
- Mobile-responsive UI.

**Success Criteria:** User can subscribe to newsletters using generated addresses and read them entirely through the Focus Reader UI, with no need to check email.

### Phase 2 — Polish & Power Features

**Goal:** A refined daily-driver reading experience.

**Deliverables:**

- Full-text search.
- Keyboard navigation.
- Auto-tagging rules.
- Confirmation email detection and handling.

**Success Criteria:** User has fully migrated all newsletter subscriptions away from their inbox to Focus Reader.

### Phase 3 — Highlights, Collections & Export (COMPLETE)

**Goal:** Feature parity with commercial readers for power users.

**Deliverables:**

- Highlighting and annotation system (text selection, colors, notes).
- Collections (curated reading lists with drag-and-drop reordering).
- Full data export (JSON, Markdown, ZIP).
- Customizable reading preferences (font, size, line height, width).

**Success Criteria:** User has fully replaced Readwise Reader with Focus Reader for daily use.

> **Note:** See [focus-reader-prd.md](./focus-reader-prd-v1.md) for the canonical phase definitions. Phase 4 (Intelligence Layer) covers AI-assisted features: LLM auto-tagging, summaries, digest generation.

---

## 7. Technical Considerations

### 7.1 Deliverability & Reliability

- Some newsletter platforms verify recipient addresses by sending a confirmation email with a click-to-verify link. The system detects these (see Section 5.1, Confirmation Email Detection) and surfaces them in the UI for manual action.
- Some senders check MX records and may reject delivery to custom domains without proper DNS configuration. Ensure MX, SPF, DKIM, and DMARC records are correctly set.
- Implement idempotent processing: deduplicate by `Message-ID` header in `Document_Email_Meta` (with fallback fingerprint) to handle sender retries. See Section 5.1, Deduplication.

**Observability:**

- Every ingestion attempt is logged in the `Ingestion_Log` table (see Section 4).
- A Cron Trigger Worker computes a daily reliability report (success/failure rate over the prior 30 days) and writes results to a reports table. The UI renders these reports on an admin dashboard page.

### 7.2 Email HTML Challenges

- Newsletter HTML uses heavy inline styles, table-based layouts, and tracking pixels.
- Sanitization must strip tracking pixels (`<img>` tags with 1x1 dimensions or known tracker domains) and external scripts while preserving layout and legitimate images.
- Markdown conversion will be lossy for complex layouts — this is acceptable; the HTML view is primary, Markdown is a convenience.

### 7.3 Storage & Costs

- At personal scale (50 newsletters × 4 emails/month = 200 documents/month), storage is trivial.
- Each email document is roughly 50–200 KB of HTML. Annual storage: ~50 MB. Well within free tiers.
- Cloudflare D1 free tier: 5 GB. More than sufficient.
- If storing images locally (rather than hotlinking), storage grows significantly — consider keeping external image references with a proxy/cache.

### 7.4 Security

- **UI and API routes:** Protected by **Cloudflare Access** (zero-trust). No application-level auth code is required. The operator configures an Access policy for the Pages domain.
- **Ingestion endpoints:** Email Worker event handlers are not public HTTP routes; they are triggered by Cloudflare's email routing infrastructure. Rate-limit and validate inbound messages to prevent abuse of the catch-all address.
- **Feed endpoints:** Exposed on a separate route/hostname from the Access-protected app and authenticated by a per-user opaque token in the URL. Tokens are stored hashed (SHA-256) in D1 via the `Feed_Token` table. The UI supports token creation, rotation, and revocation.

---

## 8. Similar apps & References

| Project                                              | Relevance                                     | Notes                                                                         |
|------------------------------------------------------|-----------------------------------------------|-------------------------------------------------------------------------------|
| [Omnivore](https://github.com/omnivore-app/omnivore) | Full read-later app with newsletter ingestion | Acquired by ElevenLabs. Open source codebase may be available for reference.  |
| [Feedbin](https://feedbin.com)                       | RSS reader with newsletter email addresses    | Polished commercial product. Closest existing implementation of this concept. |
| [Readwise Reader](https://readwise.io/read)          | Reader with newsletter + RSS + read-later     | Commercial. Strong UX reference for the reader interface.                     |

---

## 9. Resolved Design Decisions

1. **Image handling:** Start with hotlinking from original sources for simplicity. A local proxy/cache layer will be considered in Phase 2 to address link rot and privacy concerns.
2. **Multi-device sync:** Read/unread state is stored in the database and exposed via the UI, so it is inherently consistent across devices. No additional sync mechanism is needed.
3. **Unsubscribe handling:** The system will parse `List-Unsubscribe` headers and provide a one-click unsubscribe action in the UI (not yet implemented).
4. **Retention policy:** No automatic archival or deletion of old documents. All content is retained indefinitely.
5. **Import/export:** Not required for v1. Will be revisited when RSS subscription features are implemented.

---

## 10. Success Metrics

- **Adoption:** 100% of newsletter subscriptions migrated to Focus Reader within 30 days of Phase 1 launch.
- **Reliability:** ≥99% of inbound newsletters successfully received and parsed (measured over 30 days).
- **Engagement:** User opens the reader UI at least 4× per week.
- **Inbox reduction:** Zero newsletter emails in the user's primary inbox.
