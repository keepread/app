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

> **Definition of "self-hosted":** In this context, self-hosted means deploying the application to an individual's own Cloudflare account (using Workers, D1, Pages, etc.) in a single-tenant, non-SaaS configuration. The user owns and operates the infrastructure; there is no shared multi-tenant service.

### 1.3 Goals

- Eliminate newsletter clutter from the user's primary inbox.
- Provide a dedicated, distraction-free reading experience for newsletters.
- Allow the user to generate unlimited pseudo email addresses for subscriptions.
- Support an existing tagging/categorization system for organizing content.
- Optionally expose ingested newsletters as RSS/Atom feeds for interoperability with other readers.

### 1.4 Non-Goals

- This is not a general-purpose email client.
- This is not a collaborative or multi-tenant SaaS product (v1 targets single-user, self-hosted use).
- This does not handle transactional or marketing email beyond newsletters.
- This does not provide email sending capabilities.

---

## 2. Target User

A single power user (the system operator) who subscribes to many email newsletters, values organized reading workflows, and is comfortable self-hosting a lightweight application.

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

### 4.0 Terminology Glossary

- **Subscription:** A newsletter source mapped to one pseudo email address (e.g., `techweekly@read.yourdomain.com`).
- **Newsletter item:** A single ingested newsletter email belonging to a subscription.
- **Tag:** A user-defined label used to organize subscriptions and newsletter items.
- **Attachment:** Metadata for a file or inline MIME part associated with a newsletter item.
- **Ingestion event:** One processing attempt for an inbound email, recorded in `Ingestion_Log`.

### 4.1 Core Entities

> **Implementation notes:** All UUIDs are stored as `TEXT` columns using `crypto.randomUUID()`. Tags use normalized join tables (`subscription_tags`, `newsletter_item_tags`) rather than array columns, since D1/SQLite does not support array types.

#### Subscription

| Field            | Type            | Description                                                                                      |
|------------------|-----------------|--------------------------------------------------------------------------------------------------|
| `id`             | TEXT (UUID)     | Primary key, generated via `crypto.randomUUID()`                                                 |
| `pseudo_email`   | TEXT (unique)   | The generated email address (e.g., `techweekly@read.yourdomain.com`)                             |
| `display_name`   | TEXT            | Human-readable name for the subscription                                                         |
| `sender_address` | TEXT            | The `From` address of the newsletter                                                             |
| `sender_name`    | TEXT            | The `From` display name                                                                          |
| `is_active`      | INTEGER (bool)  | Whether this subscription is currently active                                                    |
| `auto_tag_rules` | TEXT (JSON)     | Optional rules for auto-tagging incoming newsletter items                                        |
| `created_at`     | TEXT (ISO 8601) | When the subscription was first seen                                                             |
| `updated_at`     | TEXT (ISO 8601) | Last update time                                                                                 |
| `deleted_at`     | TEXT (ISO 8601) | Soft-delete timestamp. Null when active. Soft-deleted subscriptions can be manually hard-deleted |

#### Newsletter_Item (Individual Newsletter Email)

| Field                | Type            | Description                                                                                                                 |
|----------------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------|
| `id`                 | TEXT (UUID)     | Primary key, generated via `crypto.randomUUID()`                                                                            |
| `subscription_id`    | TEXT (FK)       | Link to parent subscription                                                                                                 |
| `message_id`         | TEXT (unique)   | Email `Message-ID` header, used for deduplication                                                                           |
| `fingerprint`        | TEXT (unique)   | Fallback dedup key: hash of `recipient + from_address + subject + date_bucket + body_hash`. Null if `message_id` is present |
| `subject`            | TEXT            | Email subject line                                                                                                          |
| `from_address`       | TEXT            | Sender email                                                                                                                |
| `from_name`          | TEXT            | Sender display name                                                                                                         |
| `received_at`        | TEXT (ISO 8601) | When the email was received                                                                                                 |
| `html_content`       | TEXT            | Sanitized HTML body                                                                                                         |
| `markdown_content`   | TEXT            | Converted Markdown body                                                                                                     |
| `plain_text_content` | TEXT            | Plain text fallback                                                                                                         |
| `raw_headers`        | TEXT (JSON)     | Original email headers (for debugging)                                                                                      |
| `is_read`            | INTEGER (bool)  | Read status                                                                                                                 |
| `is_starred`         | INTEGER (bool)  | Starred/bookmarked status                                                                                                   |
| `is_rejected`        | INTEGER (bool)  | Whether the email failed validation (empty body, spam). Default 0                                                           |
| `rejection_reason`   | TEXT            | Why the email was flagged (null if not rejected)                                                                            |
| `needs_confirmation` | INTEGER (bool)  | Whether this is a confirmation/verification email requiring manual action. Default 0                                        |
| `delivery_attempts`  | INTEGER         | Internal-only counter of duplicate delivery attempts. Default 1. Not exposed in API/UI                                      |
| `updated_at`         | TEXT (ISO 8601) | Last update time (used for deduplication updates and newsletter item state changes)                                         |
| `summary`            | TEXT            | Optional LLM-generated summary                                                                                              |

#### Tag

| Field         | Type            | Description          |
|---------------|-----------------|----------------------|
| `id`          | TEXT (UUID)     | Primary key          |
| `name`        | TEXT (unique)   | Tag name             |
| `color`       | TEXT            | Display color (hex)  |
| `description` | TEXT            | Optional description |
| `created_at`  | TEXT (ISO 8601) | Creation time        |

#### Attachment

| Field                | Type            | Description                                                                   |
|----------------------|-----------------|-------------------------------------------------------------------------------|
| `id`                 | TEXT (UUID)     | Primary key                                                                   |
| `newsletter_item_id` | TEXT (FK)       | References `newsletter_item`                                                  |
| `filename`           | TEXT            | Original filename from MIME part                                              |
| `content_type`       | TEXT            | MIME content type (e.g., `application/pdf`)                                   |
| `size_bytes`         | INTEGER         | Size of the attachment in bytes                                               |
| `content_id`         | TEXT            | MIME Content-ID for inline images (nullable; null for non-inline attachments) |
| `storage_key`        | TEXT            | R2 object key (nullable; null in v1 metadata-only mode)                       |
| `created_at`         | TEXT (ISO 8601) | Creation time                                                                 |

#### Denylist

| Field        | Type            | Description                                        |
|--------------|-----------------|----------------------------------------------------|
| `id`         | TEXT (UUID)     | Primary key                                        |
| `domain`     | TEXT (unique)   | Sender domain to reject (e.g., `spam.example.com`) |
| `reason`     | TEXT            | Why this domain is denied                          |
| `created_at` | TEXT (ISO 8601) | When the entry was added                           |

#### Feed_Token

| Field         | Type            | Description                                                  |
|---------------|-----------------|--------------------------------------------------------------|
| `id`          | TEXT (UUID)     | Primary key                                                  |
| `token_hash`  | TEXT (unique)   | SHA-256 hash of the opaque token. Plaintext is never stored  |
| `label`       | TEXT            | User-assigned label for this token                           |
| `created_at`  | TEXT (ISO 8601) | Creation time                                                |
| `revoked_at`  | TEXT (ISO 8601) | Revocation timestamp (null if active)                        |

#### Ingestion_Log

| Field                | Type            | Description                                                               |
|----------------------|-----------------|---------------------------------------------------------------------------|
| `id`                 | TEXT (UUID)     | Primary key                                                               |
| `event_id`           | TEXT            | Unique identifier for the inbound email event                             |
| `newsletter_item_id` | TEXT (FK)       | References `newsletter_item` (nullable if ingestion failed before insert) |
| `received_at`        | TEXT (ISO 8601) | When the email was received                                               |
| `status`             | TEXT            | `success` or `failure`                                                    |
| `error_code`         | TEXT            | Error classification (nullable on success)                                |
| `error_detail`       | TEXT            | Detailed error message (nullable on success)                              |
| `attempts`           | INTEGER         | Number of inline retry attempts made                                      |

#### Subscription_Tags (Join Table)

| Field             | Type      | Description                |
|-------------------|-----------|----------------------------|
| `subscription_id` | TEXT (FK) | References `subscription`  |
| `tag_id`          | TEXT (FK) | References `tag`           |

Primary key: (`subscription_id`, `tag_id`)

#### Newsletter_Item_Tags (Join Table)

| Field                | Type      | Description                  |
|----------------------|-----------|------------------------------|
| `newsletter_item_id` | TEXT (FK) | References `newsletter_item` |
| `tag_id`             | TEXT (FK) | References `tag`             |

Primary key: (`newsletter_item_id`, `tag_id`)

---

## 5. Feature Specifications

### 5.1 Email Ingestion Pipeline

**Priority:** P0 (Critical)

**Description:** Receive inbound emails at pseudo addresses, parse them, and store them as newsletter items.

**Functional Requirements:**

- Accept inbound email on any address at the configured subdomain (catch-all).
- Parse MIME content to extract: subject, sender, date, HTML body, plain text body, and headers.
- Sanitize HTML body: remove tracking pixels, external scripts, and unsafe elements. Preserve layout and images.
- Convert sanitized HTML to Markdown.
- If no matching subscription exists for the recipient address, auto-create one using the local part as the display name and the sender info from the email.
- Store the parsed newsletter item in the database linked to the subscription.
- Extract attachment metadata from MIME parts and store in the `Attachment` table. v1 stores metadata only (no binary persistence; `storage_key` is null). Binary storage via R2 is a Phase 2 enhancement.
- v1 does not resolve/render `cid:` inline images in the reader; such images may appear missing until binary storage or proxy support is added in a later phase.
- Log every ingestion attempt in the `Ingestion_Log` table with `event_id`, `received_at`, `status`, `error_code`, `error_detail`, and `attempts`.

**Deduplication:**

- Primary deduplication key is the normalized `Message-ID` header.
- If `Message-ID` is missing, compute a fallback `fingerprint`: hash of `recipient + from_address + subject + date_bucket + body_hash`, where `date_bucket` is hour-level UTC.
- Duplicate arrivals do not create a new newsletter item; they update `updated_at` on the existing newsletter item and increment the internal `delivery_attempts` counter.

**Validation and Rejection:**

- `is_rejected` is set only when at least one explicit rule matches. v1 rejection rules:
  - Empty body (no HTML, no plain text after trimming).
  - Sender domain matches an entry in the `Denylist` table (managed via a settings page in the UI).
  - Known spam template match with confidence ≥ configured threshold.
- Rejected newsletter items are hidden from the default feed view but accessible via a dedicated "Rejected" view. The user can restore a rejected newsletter item to the normal feed.

**Confirmation Email Detection:**

- Confirmation/verification emails are **not** rejected. They are stored with `needs_confirmation = 1`.
- Detection signals: subject keywords (`confirm`, `verify`, `activate`), known sender patterns, and presence of high-confidence confirmation CTA links.
- The UI exposes a "Needs Confirmation" filter and renders confirmation links with a safe target preview before opening.

**Retry Policy:**

- Up to 3 inline retry attempts with exponential backoff within the same Worker invocation for transient failures (e.g., D1 write errors). No external queue or Cron-based retry.
- `success`: parsed, sanitized, and stored without error.
- `failure`: any step fails after retries are exhausted. Logged with `status = failure` plus `error_code` and `error_detail`.

**Edge Cases:**

- Multipart emails with both HTML and plain text: prefer HTML, store both.
- Emails with attachments: store attachment metadata in the `Attachment` table. Inline images populate `content_id`; regular attachments have `content_id = null`. Rendering `cid:` inline images is out of scope for Phase 1.

### 5.2 Subscription Management

**Priority:** P0 (Critical)

**Description:** Allow the user to view, edit, organize, and manage their newsletter subscriptions.

**Functional Requirements:**

- List all subscriptions with: display name, pseudo email, sender, tag(s), last received date, unread count.
- Create a new subscription manually (generate a pseudo email address).
- Edit subscription: rename, assign/remove tags, toggle active/inactive.
- Copy pseudo email address to clipboard (for pasting into newsletter signup forms).
- Show subscription stats: total newsletter items received, frequency, last received.

**Deletion semantics:**

- Deleting a subscription is a soft delete by default (`deleted_at` timestamp set, hidden from UI).
- Soft-deleted subscriptions can be restored manually at any time (no expiry). There is no automated cleanup job.
- An explicit hard-delete action permanently removes the subscription, its newsletter items, tag links, and attachment metadata.

### 5.3 Reader Interface

**Priority:** P0 (Critical)

**Description:** An RSS-reader-style web interface for browsing and reading newsletters.

**Functional Requirements:**

- **Left sidebar:** List of subscriptions, grouped by tags/folders. Show unread counts. Include an "All" view, a "Starred" view, a "Needs Confirmation" filter, and a "Rejected" view.
- **Feed view (center pane):** Chronological list of newsletter items for the selected subscription, tag, or "All". Show subject, sender, date, preview snippet, read/unread status. Pagination: 50 newsletter items per page with "Load more".
- **Reading pane (right or expanded):** Render the sanitized HTML content of the selected newsletter item. Toggle between HTML and Markdown views.
- Mark newsletter items as read/unread. Opening a newsletter item auto-marks it as read after 1.5 seconds of focused visibility (in both three-pane and Focus Mode layouts); manual toggle remains available.
- Star/bookmark newsletter items.
- Keyboard navigation: `j`/`k` for next/previous newsletter item, `s` to star, `m` to toggle read. Keyboard shortcuts are disabled while focus is inside editable inputs.
- Responsive design: desktop default is three-pane layout; mobile default is stacked navigation (list → feed → reader).
- Focus mode: Reading view that makes the content from the reading pane full-width and hides distractions.

### 5.4 Tagging System

**Priority:** P1 (High)

**Description:** Flexible tagging for organizing subscriptions and individual newsletter items.

**Functional Requirements:**

- Create, edit, delete tags with name and color.
- Assign multiple tags to a subscription (all future newsletter items inherit these tags).
- Assign additional tags to individual newsletter items.
- Filter the feed view by one or more tags.
- Auto-tagging rules: define rules per subscription or globally based on sender domain, subject keywords, or content keywords.
- Optional: LLM-based auto-tagging — on ingestion, classify the newsletter item against the existing tag taxonomy and suggest/apply tags.

### 5.5 Search

**Priority:** P1 (High)

**Description:** Full-text search across all stored newsletters.

**Functional Requirements:**

- Search by: subject, sender, body content, tags.
- Filter results by: subscription, tag, date range, read/unread status.
- Return results ranked by relevance with highlighted snippets.

**Implementation:**

- Search (including D1/SQLite FTS5 indexing) is introduced in Phase 2.
- FTS5 indexed fields: `subject`, `from_name`, `from_address`, `plain_text_content`, `markdown_content`, and tag names.
- FTS index updates are part of the ingestion transaction; failures must roll back the newsletter item insert to maintain index consistency.

### 5.6 Summarization (Optional / Future)

**Priority:** P3 (Low)

**Description:** LLM-generated summaries of newsletter items for quick scanning.

**Functional Requirements:**

- On ingestion (or on demand), generate a 2–3 sentence summary of each newsletter item.
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
- Feed items include: title (subject), content (sanitized HTML), author (sender), published date.

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
- Mark read/unread, star newsletter items.
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

### Phase 3 — Intelligence Layer

**Goal:** AI-assisted organization and summarization.

**Deliverables:**

- RSS/Atom feed output.
- LLM-based auto-tagging on ingestion.
- Per-newsletter-item summaries.
- Daily/weekly digest generation.

**Success Criteria:** User spends less time triaging and more time reading high-value content.

---

## 7. Technical Considerations

### 7.1 Deliverability & Reliability

- Some newsletter platforms verify recipient addresses by sending a confirmation email with a click-to-verify link. The system detects these (see Section 5.1, Confirmation Email Detection) and surfaces them in the UI for manual action.
- Some senders check MX records and may reject delivery to custom domains without proper DNS configuration. Ensure MX, SPF, DKIM, and DMARC records are correctly set.
- Implement idempotent processing: deduplicate by `Message-ID` header (with fallback fingerprint) to handle sender retries. See Section 5.1, Deduplication.

**Observability:**

- Every ingestion attempt is logged in the `Ingestion_Log` table (see Section 4).
- A Cron Trigger Worker computes a daily reliability report (success/failure rate over the prior 30 days) and writes results to a reports table. The UI renders these reports on an admin dashboard page.

### 7.2 Email HTML Challenges

- Newsletter HTML uses heavy inline styles, table-based layouts, and tracking pixels.
- Sanitization must strip tracking pixels (`<img>` tags with 1x1 dimensions or known tracker domains) and external scripts while preserving layout and legitimate images.
- Markdown conversion will be lossy for complex layouts — this is acceptable; the HTML view is primary, Markdown is a convenience.

### 7.3 Storage & Costs

- At personal scale (50 newsletters × 4 newsletter items/month = 200 newsletter items/month), storage is trivial.
- Each newsletter item is roughly 50–200 KB of HTML. Annual storage: ~50 MB. Well within free tiers.
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
3. **Unsubscribe handling:** The system will parse `List-Unsubscribe` headers and provide a one-click unsubscribe action in the UI, planned for Phase 3.
4. **Retention policy:** No automatic archival or deletion of old newsletter items. All content is retained indefinitely.
5. **Import/export:** Not required for v1. Will be revisited when RSS subscription features are implemented.

---

## 10. Success Metrics

- **Adoption:** 100% of newsletter subscriptions migrated to Focus Reader within 30 days of Phase 1 launch.
- **Reliability:** ≥99% of inbound newsletters successfully received and parsed (measured over 30 days).
- **Engagement:** User opens the reader UI at least 4× per week.
- **Inbox reduction:** Zero newsletter emails in the user's primary inbox.
