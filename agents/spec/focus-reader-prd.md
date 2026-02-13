# Product Requirements Document: Focus Reader

**Version:** 1.0
**Date:** February 13, 2026
**Status:** Draft

---

## 1. Overview

### 1.1 Problem Statement

The modern knowledge worker consumes information from a fragmented landscape: web articles, PDFs, email newsletters, RSS feeds, social media posts, YouTube videos, and podcasts. Existing tools force users to juggle multiple apps — a read-it-later app for articles, a PDF viewer, an RSS reader, an email client for newsletters, and browser bookmarks for everything else. This fragmentation means:

- No single place to search, organize, or revisit saved content.
- Context-switching between apps disrupts reading flow and deep focus.
- Highlights, notes, and annotations are scattered across tools with no unified export.
- Email newsletters clutter the inbox, mixing long-form reading with actionable correspondence.

Commercial products like Readwise Reader address this well, but are closed-source, subscription-based, and cannot be self-hosted or customized.

### 1.2 Product Vision

**Focus Reader** is a self-hosted, open-source read-it-later application that unifies all reading content — web articles, bookmarks, PDFs, email newsletters, RSS feeds, social media posts, and other internet resources — into a single, distraction-free reading interface with highlighting, annotation, tagging, and full-text search.

> **Definition of "self-hosted":** The application is deployed to the user's own Cloudflare account (using Workers, D1, Pages, R2, etc.) in a single-tenant configuration. The user owns and operates the infrastructure; there is no shared multi-tenant service.

### 1.3 Goals

- Provide a single unified inbox for all reading content regardless of source.
- Eliminate newsletter clutter from the user's primary email inbox.
- Support saving content from any source: web, email, RSS, file upload, API.
- Offer a distraction-free, keyboard-driven reading experience.
- Enable rich annotation: highlights, notes, and tags on any content type.
- Provide full-text search across all saved content.
- Expose a REST API for programmatic access and third-party integrations.
- Store all content in Markdown for portability and easy export to note-taking apps (e.g., Obsidian, Logseq).
- Remain self-hosted, open-source, and fully customizable.

### 1.4 Non-Goals

- This is not a general-purpose email client.
- This is not a collaborative or multi-tenant SaaS product (v1 targets single-user, self-hosted use).
- This is not a note-taking app (though it integrates with them via export).
- This does not handle email sending.
- This does not provide social features (sharing, commenting with others).
- This is not a podcast player or video player — it handles transcripts for these media types, not playback.

---

## 2. Target User

A single power user (the system operator) who:

- Consumes information from many sources (articles, newsletters, RSS, PDFs).
- Values organized reading workflows and distraction-free focus.
- Wants to highlight, annotate, and revisit content over time.
- Is comfortable self-hosting a lightweight application on Cloudflare.
- Prefers owning their data over depending on a commercial SaaS.

---

## 3. Content Types

Focus Reader treats all saved content as **Documents**. Each document has a `type` that determines how it was ingested and how it is rendered.

| Type       | Description                                            | Ingestion Method                    |
|------------|--------------------------------------------------------|-------------------------------------|
| `article`  | Web page or blog post                                  | Browser extension, URL paste, API   |
| `pdf`      | PDF document                                           | File upload, URL, API               |
| `email`    | Email newsletter                                       | Dedicated email address (catch-all) |
| `rss`      | RSS/Atom feed item                                     | RSS subscription                    |
| `bookmark` | Lightweight bookmark (URL + metadata, no full content) | Browser extension, URL paste, API   |
| `post`     | Social media post (tweet, thread, etc.)                | URL paste, API                      |

> **Future types** (not in v1): `epub`, `video` (YouTube transcript), `podcast` (transcript).

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Ingestion Layer                          │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Email      │ │  RSS Fetch  │ │  Browser Extension      │ │
│  │  Worker     │ │  (Cron)     │ │  (save URL/file/post)   │ │
│  └──────┬──────┘ └──────┬──────┘ └────────────┬────────────┘ │
│         │               │                     │              │
│         └───────────────┼─────────────────────┘              │
│                         ▼                                    │
│              ┌──────────────────┐                            │
│              │  Content Parser  │                            │
│              │  & Sanitizer     │                            │
│              └────────┬─────────┘                            │
└───────────────────────┼──────────────────────────────────────┘
                        ▼
              ┌──────────────────┐
              │  Storage Layer   │
              │  D1 + R2         │
              └────────┬─────────┘
                       ▼
              ┌──────────────────────────────────┐
              │  REST API (Workers)               │
              │  All data access goes through     │
              │  this single authenticated API    │
              └──────────┬───────────────────────┘
                         │
              ┌──────────┼───────────────────────┐
              ▼          ▼                       ▼
     ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
     │  Web UI      │ │  Browser     │  │  RSS/Atom    │
     │  (Next.js/   │ │  Extension   │  │  Feed Output │
     │   Pages)     │ │              │  │              │
     └──────────────┘ └──────────────┘  └──────────────┘
```

> **Note on the API layer:** There is a single REST API that serves all clients — the web UI, the browser extension, and any third-party integrations. The term "API" in this document always refers to this single API. The browser extension in the ingestion layer calls the same API endpoints (e.g., `POST /api/documents`) that any external client would use. The web UI uses the same API via its Next.js server-side routes. There is no separate "public" vs. "internal" API — it is one API, fully authenticated (see Section 6.12).

### 4.2 Stack

| Layer             | Technology                                                           | Rationale                                                                           |
|-------------------|----------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| Email Ingestion   | Cloudflare Email Workers                                             | Zero server management, programmable hooks on inbound email, free at personal scale |
| RSS Fetching      | Cloudflare Workers + Cron Triggers                                   | Scheduled polling of RSS/Atom feeds at configurable intervals                       |
| Article Parsing   | Readability algorithm (Mozilla `@mozilla/readability` or equivalent) | Extracts clean article content from arbitrary web pages                             |
| Database          | Cloudflare D1 (SQLite)                                               | Serverless SQL, all-Cloudflare stack, free tier sufficient for personal use         |
| Object Storage    | Cloudflare R2                                                        | PDF storage, cached images, file uploads. S3-compatible, no egress fees             |
| Web UI            | Next.js on Cloudflare Pages                                          | Rich ecosystem, API routes, deployed via `@cloudflare/next-on-pages`                |
| Email Parsing     | `postal-mime`                                                        | Works natively in Workers (no Node.js APIs)                                         |
| HTML Sanitization | DOMPurify + `linkedom`                                               | DOMPurify is the gold standard; `linkedom` provides the DOM shim needed in Workers  |
| HTML → Markdown   | Turndown                                                             | Well-maintained HTML-to-Markdown conversion library                                 |
| Authentication    | Cloudflare Access                                                    | Zero-trust, no auth code to write, free for up to 50 users                          |

### 4.3 Email Addressing Strategy

> This section is carried forward from the [Email Newsletter PRD](./email-newsletter-prd.md), Section 3.3. The email ingestion subsystem is specified in full detail in that document.

Use a **catch-all configuration on a dedicated subdomain** (e.g., `*@read.yourdomain.com`).

- Each newsletter subscription gets a unique address: `techweekly@read.yourdomain.com`.
- The local part (before `@`) implicitly identifies the subscription.
- No pre-configuration needed — any new address auto-creates a subscription on first email received.
- Optional `+` subaddressing for metadata: `tech+ai@read.yourdomain.com`. In this example, `ai` could be parsed as an auto-tag rule to tag all emails to this address with tag `ai`.
- Domain configured via `EMAIL_DOMAIN` environment variable.

---

## 5. Data Model

### 5.0 Terminology Glossary

- **Document:** Any saved content item (article, PDF, email newsletter, RSS item, bookmark, post).
- **Source:** The origin of a document — a subscription (email), a feed (RSS), or a one-off save (article/PDF/bookmark/post).
- **Feed:** An RSS/Atom feed the user has subscribed to.
- **Subscription:** An email newsletter source mapped to a pseudo email address.
- **Tag:** A user-defined label for organizing documents.
- **Highlight:** A user-selected passage within a document, optionally with a note.
- **Collection:** A curated, ordered group of documents (like a playlist or reading list).

### 5.1 Core Entities

> **Implementation notes:** All UUIDs are stored as `TEXT` columns using `crypto.randomUUID()`. Tags use normalized join tables. Timestamps are ISO 8601 strings.

#### Document

The universal content entity. Every piece of saved content — regardless of format or origin — is stored as a row in this table. Type-specific fields are nullable where not applicable.

> **Clarification: `type` vs. `source_type`**
>
> - **`type`** describes *what the content is* — its format and how it is rendered. For example: `article`, `pdf`, `email`, `rss`, `bookmark`, `post`.
> - **`source_type`** describes *how the content arrived* — the ingestion channel that created it. For example: `subscription` (came via email), `feed` (came via RSS polling), or `manual` (user saved it via URL paste, browser extension, file upload, or API call).
>
> These are orthogonal. An `article` (type) could arrive from an RSS feed (source_type = `feed`) or be manually saved (source_type = `manual`). An `email` (type) always comes from a `subscription` (source_type). A `pdf` (type) is always `manual` (source_type).

| Field                  | Type            | Description                                                      |
|------------------------|-----------------|------------------------------------------------------------------|
| `id`                   | TEXT (UUID)     | Primary key                                                      |
| `type`                 | TEXT            | One of: `article`, `pdf`, `email`, `rss`, `bookmark`, `post`     |
| `url`                  | TEXT            | Original URL (nullable for email-only content)                   |
| `title`                | TEXT            | Document title / email subject / post heading                    |
| `author`               | TEXT            | Author name or sender name                                       |
| `author_url`           | TEXT            | Author's profile or website URL (nullable)                       |
| `site_name`            | TEXT            | Publisher / site name (e.g., "The Verge")                        |
| `excerpt`              | TEXT            | Short preview / description / first paragraph                    |
| `word_count`           | INTEGER         | Estimated word count of the content                              |
| `reading_time_minutes` | INTEGER         | Estimated reading time in minutes                                |
| `cover_image_url`      | TEXT            | Hero image or Open Graph image URL                               |
| `html_content`         | TEXT            | Sanitized HTML content                                           |
| `markdown_content`     | TEXT            | Converted Markdown content                                       |
| `plain_text_content`   | TEXT            | Plain text content (used for search indexing)                    |
| `location`             | TEXT            | Triage state: `inbox`, `later`, `archive`                        |
| `is_read`              | INTEGER (bool)  | Read status                                                      |
| `is_starred`           | INTEGER (bool)  | Starred / favorited                                              |
| `reading_progress`     | REAL            | Reading progress as a decimal (0.0 to 1.0)                       |
| `last_read_at`         | TEXT (ISO 8601) | When the document was last opened for reading                    |
| `saved_at`             | TEXT (ISO 8601) | When the document was saved to Focus Reader                      |
| `published_at`         | TEXT (ISO 8601) | When the content was originally published                        |
| `updated_at`           | TEXT (ISO 8601) | Last update time                                                 |
| `deleted_at`           | TEXT (ISO 8601) | Soft-delete timestamp (null when active)                         |
| `source_id`            | TEXT (FK)       | References `subscription` or `feed` (nullable for one-off saves) |
| `source_type`          | TEXT            | `subscription`, `feed`, or `manual`                              |

#### Document_Email_Meta

Email-specific metadata that only applies to documents with `type = 'email'`. Stored in a separate table to keep the universal `Document` table clean. Contains deduplication keys (`message_id`, `fingerprint`), sender details, rejection/confirmation flags, and raw email headers for debugging.

| Field                | Type           | Description                                 |
|----------------------|----------------|---------------------------------------------|
| `document_id`        | TEXT (FK, PK)  | References `document`                       |
| `message_id`         | TEXT (unique)  | Email `Message-ID` header for deduplication |
| `fingerprint`        | TEXT (unique)  | Fallback dedup key (see email PRD)          |
| `from_address`       | TEXT           | Sender email address                        |
| `from_name`          | TEXT           | Sender display name                         |
| `raw_headers`        | TEXT (JSON)    | Original email headers                      |
| `is_rejected`        | INTEGER (bool) | Whether the email failed validation         |
| `rejection_reason`   | TEXT           | Why the email was flagged                   |
| `needs_confirmation` | INTEGER (bool) | Whether this is a confirmation email        |
| `delivery_attempts`  | INTEGER        | Duplicate delivery counter                  |

#### Document_PDF_Meta

PDF-specific metadata that only applies to documents with `type = 'pdf'`. Tracks page count, file size, and the R2 storage key for the uploaded PDF binary.

| Field             | Type          | Description                      |
|-------------------|---------------|----------------------------------|
| `document_id`     | TEXT (FK, PK) | References `document`            |
| `page_count`      | INTEGER       | Number of pages                  |
| `file_size_bytes` | INTEGER       | PDF file size                    |
| `storage_key`     | TEXT          | R2 object key for the stored PDF |

#### Subscription

An email newsletter source mapped to a pseudo email address. Each subscription represents one newsletter the user has signed up for. Documents with `type = 'email'` reference a subscription via `source_id`.

> Carried forward from the [Email Newsletter PRD](./email-newsletter-prd.md), Section 4.1, with minor field additions to link into the unified document model.

| Field            | Type            | Description                          |
|------------------|-----------------|--------------------------------------|
| `id`             | TEXT (UUID)     | Primary key                          |
| `pseudo_email`   | TEXT (unique)   | Generated email address              |
| `display_name`   | TEXT            | Human-readable name                  |
| `sender_address` | TEXT            | The `From` address of the newsletter |
| `sender_name`    | TEXT            | The `From` display name              |
| `is_active`      | INTEGER (bool)  | Whether this subscription is active  |
| `auto_tag_rules` | TEXT (JSON)     | Optional rules for auto-tagging      |
| `created_at`     | TEXT (ISO 8601) | When first seen                      |
| `updated_at`     | TEXT (ISO 8601) | Last update time                     |
| `deleted_at`     | TEXT (ISO 8601) | Soft-delete timestamp                |

#### Feed

An RSS/Atom feed the user has subscribed to. The system polls each active feed on a configurable interval and creates `Document` records (with `type = 'rss'`) for new items. Tracks fetch state, error counts, and auto-tagging rules.

| Field                    | Type            | Description                                 |
|--------------------------|-----------------|---------------------------------------------|
| `id`                     | TEXT (UUID)     | Primary key                                 |
| `feed_url`               | TEXT (unique)   | URL of the RSS/Atom feed                    |
| `site_url`               | TEXT            | URL of the website                          |
| `title`                  | TEXT            | Feed title                                  |
| `description`            | TEXT            | Feed description                            |
| `icon_url`               | TEXT            | Feed favicon or icon                        |
| `last_fetched_at`        | TEXT (ISO 8601) | Last successful fetch                       |
| `fetch_interval_minutes` | INTEGER         | Polling interval (default: 60)              |
| `is_active`              | INTEGER (bool)  | Whether this feed is active                 |
| `auto_tag_rules`         | TEXT (JSON)     | Optional rules for auto-tagging             |
| `error_count`            | INTEGER         | Consecutive fetch errors (reset on success) |
| `last_error`             | TEXT            | Last fetch error message                    |
| `created_at`             | TEXT (ISO 8601) | When the feed was added                     |
| `updated_at`             | TEXT (ISO 8601) | Last update time                            |
| `deleted_at`             | TEXT (ISO 8601) | Soft-delete timestamp                       |

#### Tag

A user-defined label for organizing content. Tags can be applied to documents, highlights, subscriptions, and feeds. Used for filtering views, auto-tagging rules, and grouping content in the sidebar.

| Field         | Type            | Description          |
|---------------|-----------------|----------------------|
| `id`          | TEXT (UUID)     | Primary key          |
| `name`        | TEXT (unique)   | Tag name             |
| `color`       | TEXT            | Display color (hex)  |
| `description` | TEXT            | Optional description |
| `created_at`  | TEXT (ISO 8601) | Creation time        |

#### Highlight

A user-selected text passage within a document, optionally annotated with a note and tagged. Highlights are the core annotation primitive — they enable the user to mark important passages, add thoughts, and later export them to note-taking apps. Each highlight is anchored to its position in the document so it persists across re-renders.

| Field               | Type            | Description                                                                     |
|---------------------|-----------------|---------------------------------------------------------------------------------|
| `id`                | TEXT (UUID)     | Primary key                                                                     |
| `document_id`       | TEXT (FK)       | References `document`                                                           |
| `text`              | TEXT            | The highlighted text passage                                                    |
| `note`              | TEXT            | User's note on this highlight (nullable)                                        |
| `color`             | TEXT            | Highlight color (hex, default yellow)                                           |
| `position_selector` | TEXT (JSON)     | CSS selector / XPath / character offset to locate the highlight in the document |
| `position_percent`  | REAL            | Approximate position in the document (0.0–1.0) for sorting                      |
| `created_at`        | TEXT (ISO 8601) | When the highlight was created                                                  |
| `updated_at`        | TEXT (ISO 8601) | Last update time                                                                |

#### Collection

A curated, ordered group of documents — like a reading list or playlist. Collections let the user manually organize documents into meaningful groups beyond what tags provide (e.g., "Research for Project X", "Best of 2026"). Documents can belong to multiple collections.

| Field         | Type            | Description                                   |
|---------------|-----------------|-----------------------------------------------|
| `id`          | TEXT (UUID)     | Primary key                                   |
| `name`        | TEXT            | Collection name                               |
| `description` | TEXT            | Optional description                          |
| `is_public`   | INTEGER (bool)  | Whether the collection is publicly accessible |
| `created_at`  | TEXT (ISO 8601) | Creation time                                 |
| `updated_at`  | TEXT (ISO 8601) | Last update time                              |

#### Attachment

File or inline MIME part associated with a document (primarily email attachments). In v1, only metadata is stored; binary storage via R2 is a Phase 2 enhancement. For inline images in emails, the `content_id` field maps to the MIME Content-ID for future `cid:` resolution.

| Field          | Type            | Description                                       |
|----------------|-----------------|---------------------------------------------------|
| `id`           | TEXT (UUID)     | Primary key                                       |
| `document_id`  | TEXT (FK)       | References `document`                             |
| `filename`     | TEXT            | Original filename                                 |
| `content_type` | TEXT            | MIME content type                                 |
| `size_bytes`   | INTEGER         | Size in bytes                                     |
| `content_id`   | TEXT            | MIME Content-ID for inline images (nullable)      |
| `storage_key`  | TEXT            | R2 object key (nullable in v1 metadata-only mode) |
| `created_at`   | TEXT (ISO 8601) | Creation time                                     |

#### Denylist

A blocklist of sender domains whose emails are automatically rejected during ingestion. Managed via the settings UI. When an inbound email's sender domain matches an entry, the resulting document is flagged with `is_rejected = 1`.

| Field        | Type            | Description               |
|--------------|-----------------|---------------------------|
| `id`         | TEXT (UUID)     | Primary key               |
| `domain`     | TEXT (unique)   | Sender domain to reject   |
| `reason`     | TEXT            | Why this domain is denied |
| `created_at` | TEXT (ISO 8601) | When the entry was added  |

#### Feed_Token

Opaque bearer tokens used to authenticate RSS/Atom feed output endpoints (Section 6.11). Since feed endpoints are not protected by Cloudflare Access (so external RSS readers can fetch them), each request must include a valid token in the URL. Tokens are stored as SHA-256 hashes; the plaintext is shown once at creation and never persisted.

| Field        | Type            | Description                           |
|--------------|-----------------|---------------------------------------|
| `id`         | TEXT (UUID)     | Primary key                           |
| `token_hash` | TEXT (unique)   | SHA-256 hash of the opaque token      |
| `label`      | TEXT            | User-assigned label                   |
| `created_at` | TEXT (ISO 8601) | Creation time                         |
| `revoked_at` | TEXT (ISO 8601) | Revocation timestamp (null if active) |

#### Ingestion_Log

An audit trail of every content ingestion attempt — whether from email, RSS polling, API calls, or the browser extension. Records both successes and failures with error details. Used for the reliability dashboard and debugging ingestion issues.

| Field          | Type            | Description                                          |
|----------------|-----------------|------------------------------------------------------|
| `id`           | TEXT (UUID)     | Primary key                                          |
| `event_id`     | TEXT            | Unique identifier for the inbound event              |
| `document_id`  | TEXT (FK)       | References `document` (nullable if ingestion failed) |
| `source_type`  | TEXT            | `email`, `rss`, `api`, `extension`                   |
| `received_at`  | TEXT (ISO 8601) | When the event was received                          |
| `status`       | TEXT            | `success` or `failure`                               |
| `error_code`   | TEXT            | Error classification (nullable on success)           |
| `error_detail` | TEXT            | Detailed error message (nullable on success)         |
| `attempts`     | INTEGER         | Number of retry attempts                             |

### 5.2 Join Tables

#### Document_Tags

Associates tags with documents. A document can have many tags, and a tag can be applied to many documents. This is the primary organizational mechanism for the user's content library.

| Field         | Type      | Description           |
|---------------|-----------|-----------------------|
| `document_id` | TEXT (FK) | References `document` |
| `tag_id`      | TEXT (FK) | References `tag`      |

Primary key: (`document_id`, `tag_id`)

#### Highlight_Tags

Associates tags with individual highlights — separate from document-level tags. This enables a finer-grained organizational layer: for example, a user might tag a document as "Machine Learning" but tag a specific highlighted passage within it as "key-insight" or "actionable". Highlight tags power filtered views like "show me all highlights tagged 'actionable' across all documents" and are included in Markdown exports to note-taking apps.

| Field          | Type      | Description            |
|----------------|-----------|------------------------|
| `highlight_id` | TEXT (FK) | References `highlight` |
| `tag_id`       | TEXT (FK) | References `tag`       |

Primary key: (`highlight_id`, `tag_id`)

#### Subscription_Tags

Associates tags with email subscriptions. When a subscription is tagged, all future documents ingested from that subscription automatically inherit the tag (see Section 6.5).

| Field             | Type      | Description               |
|-------------------|-----------|---------------------------|
| `subscription_id` | TEXT (FK) | References `subscription` |
| `tag_id`          | TEXT (FK) | References `tag`          |

Primary key: (`subscription_id`, `tag_id`)

#### Feed_Tags

Associates tags with RSS/Atom feeds. When a feed is tagged, all future documents ingested from that feed automatically inherit the tag (see Section 6.5).

| Field     | Type      | Description       |
|-----------|-----------|-------------------|
| `feed_id` | TEXT (FK) | References `feed` |
| `tag_id`  | TEXT (FK) | References `tag`  |

Primary key: (`feed_id`, `tag_id`)

#### Collection_Documents

Associates documents with collections and tracks their position within the collection. The `sort_order` field enables drag-and-drop reordering. A document can belong to multiple collections.

| Field           | Type            | Description                 |
|-----------------|-----------------|-----------------------------|
| `collection_id` | TEXT (FK)       | References `collection`     |
| `document_id`   | TEXT (FK)       | References `document`       |
| `sort_order`    | INTEGER         | Position in the collection  |
| `added_at`      | TEXT (ISO 8601) | When the document was added |

Primary key: (`collection_id`, `document_id`)

---

## 6. Feature Specifications

### 6.1 Content Ingestion

#### 6.1.1 Email Newsletter Ingestion

**Priority:** P0 (Critical)

> The email ingestion pipeline is specified in full detail in the [Email Newsletter PRD](./email-newsletter-prd.md), Sections 5.1–5.2. This section summarizes the integration into the unified document model.

- Receive inbound emails at pseudo addresses on a catch-all subdomain.
- Parse MIME content using `postal-mime`: extract subject, sender, date, HTML body, plain text, headers, attachments.
- Sanitize HTML: remove tracking pixels, external scripts, unsafe elements. Preserve layout and images.
- Convert sanitized HTML to Markdown using Turndown.
- Create a `Document` record with `type = 'email'` and a corresponding `Document_Email_Meta` record.
- Auto-create `Subscription` records on first email to a new address.
- Deduplicate by `Message-ID` with fallback fingerprint.
- Detect confirmation emails (`needs_confirmation`).
- Log every ingestion attempt in `Ingestion_Log`.

#### 6.1.2 Web Article Saving

**Priority:** P0 (Critical)

**Description:** Save web articles from any URL and extract clean, readable content.

**Ingestion methods:**

- **Browser extension:** Click the extension icon or press a keyboard shortcut to save the current page. The extension sends the full page HTML (not just the URL) for best parsing fidelity.
- **URL paste:** Enter a URL in the app's "Add URL" dialog.
- **API:** `POST /api/documents` with a `url` field.

**Content extraction:**

- Use a Readability algorithm (`@mozilla/readability` or equivalent) to extract the article's main content, title, author, published date, site name, and hero image.
- Sanitize the extracted HTML.
- Convert to Markdown.
- Compute word count and estimated reading time.
- Extract Open Graph / meta tag metadata as fallback for title, description, and cover image.
- Create a `Document` record with `type = 'article'`, `source_type = 'manual'`, and `location = 'inbox'`.

**Deduplication:**

- Deduplicate by normalized URL (strip tracking parameters like `utm_*`, `fbclid`, etc.).
- If a document with the same URL already exists, update its content rather than creating a duplicate. Surface a notification to the user.

#### 6.1.3 RSS Feed Subscription

**Priority:** P0 (Critical)

**Description:** Subscribe to RSS/Atom feeds and automatically ingest new items.

**Functional Requirements:**

- Add a feed by URL. Auto-detect feed URL from a website URL (look for `<link rel="alternate" type="application/rss+xml">` in the page HTML).
- Support RSS 2.0, Atom 1.0, and JSON Feed 1.1.
- Poll feeds on a configurable interval (default: 60 minutes) using Cloudflare Cron Triggers.
- On each poll, fetch new items since `last_fetched_at` and create `Document` records with `type = 'rss'`.
- For each feed item, extract: title, author, content (prefer `content:encoded` over `description`), published date, URL.
- If the feed item contains only a summary, optionally fetch the full article content from the item's link URL (configurable per feed: `fetch_full_content = true/false`).
- Support OPML import for bulk feed migration from other readers.
- Support OPML export of all subscribed feeds.

**Error handling:**

- Track consecutive fetch errors in `error_count`. After 5 consecutive failures, mark the feed as inactive and notify the user.
- Log fetch attempts in `Ingestion_Log` with `source_type = 'rss'`.

#### 6.1.4 PDF Upload and Saving

**Priority:** P1 (High)

**Description:** Save and read PDF documents within Focus Reader.

**Functional Requirements:**

- Upload PDFs via drag-and-drop, file picker, or API.
- Save PDFs from a URL.
- Store the PDF binary in Cloudflare R2.
- Extract metadata: title (from PDF metadata or filename), page count, file size.
- Extract text content for search indexing and Markdown view.
- Create a `Document` record with `type = 'pdf'` and a corresponding `Document_PDF_Meta` record.
- Render PDFs in the reading pane using a web-based PDF viewer (e.g., PDF.js).
- Support highlighting text within the PDF viewer.

#### 6.1.5 Bookmark Saving

**Priority:** P1 (High)

**Description:** Lightweight bookmarking for URLs the user wants to save without extracting full content.

**Functional Requirements:**

- Save a URL as a bookmark with minimal processing: fetch page title, description, favicon, and Open Graph image.
- No full article extraction unless the user explicitly requests it (one-click "Fetch full article" action).
- Useful for quick saves, reference links, and resources that don't have article-like content.
- Create a `Document` record with `type = 'bookmark'`.

#### 6.1.6 Social Media Post Saving

**Priority:** P2 (Medium)

**Description:** Save social media posts (tweets, threads, etc.) as documents.

**Functional Requirements:**

- Save posts from supported platforms by URL: Twitter/X (threads compiled into a single document), Mastodon, Bluesky.
- Extract: author name, handle, avatar, post text, images, posted date.
- For Twitter/X threads, compile all tweets into a single document in chronological order.
- Create a `Document` record with `type = 'post'`.

### 6.2 Reader Interface

**Priority:** P0 (Critical)

**Description:** A distraction-free, keyboard-driven reading interface for all content types.

#### 6.2.1 Layout

**Three-pane layout (desktop default):**

- **Left sidebar:** Navigation — sources (subscriptions, feeds), tags, collections, filtered views, and system views (Inbox, Later, Archive, All, Starred, Rejected).
- **Center pane (document list):** Documents for the selected view, displayed in one of two modes the user can toggle between:
  - **List view (default):** Compact rows showing: thumbnail image (OG image, site favicon, or type-specific icon as fallback), title, source/author, date, preview snippet, read/unread indicator, star indicator, reading progress.
  - **Grid view:** Card-based layout where each card shows the OG image / cover image as the main visual element, with title, source/author, and date overlaid or below. Ideal for visually browsing content. Falls back to a type-specific placeholder (e.g., a PDF icon, an email icon) when no image is available.
- **Right pane (reading pane):** Renders the selected document's content. Toggle between HTML and Markdown views for article/email content. The Markdown view serves dual purpose: a clean reading format and a copy-friendly format for pasting into note-taking apps like Obsidian. PDF viewer for PDFs.

**Responsive behavior:**

- **Desktop (≥1024px):** Three-pane layout. All panes visible simultaneously.
- **Tablet (768px–1023px):** Two-pane layout (document list + reading pane). Left sidebar is hidden by default, accessible via a hamburger menu / swipe-from-left gesture. Tapping a document in the list opens it in the reading pane.
- **Mobile (<768px):** Single-pane, stacked navigation. Only one pane is visible at a time:
  1. **Sidebar view:** Tap a source, tag, or system view (Inbox, etc.) to navigate to the document list.
  2. **Document list view:** Shows documents for the selected view. Tap a document to open it. Back button / swipe-right returns to the sidebar.
  3. **Reader view:** Full-screen reading pane for the selected document. Back button / swipe-right returns to the document list.
  - On mobile, grid view shows a 2-column card grid; list view shows compact rows with small thumbnails.
  - Bottom navigation bar provides quick access to: Inbox, Starred, Search, Settings.

**Focus mode:** Expand the reading pane to full width, hiding the sidebar and document list. Toggle with `F` key or UI button. On mobile, the reader view is inherently full-screen, so focus mode is the default reading experience.

#### 6.2.2 Triage System

All documents — regardless of how they arrived — flow through a single, unified triage pipeline:

| Location  | Description                                                                                                                                |
|-----------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `inbox`   | Newly arrived documents. Default location for all content (manual saves, RSS items, email newsletters). This is the universal entry point. |
| `later`   | Documents the user intends to read. Moved manually from inbox — an explicit "I want to read this" signal.                                  |
| `archive` | Documents the user has finished reading or wants to keep but not see in active views.                                                      |

> **Design decision: No separate Feed vs. Library.** Readwise Reader uses a two-zone system (Feed with seen/unseen vs. Library with inbox/later/archive). We intentionally do **not** adopt this pattern. Having two parallel systems with different state models (`seen`/`unseen` vs. `inbox`/`later`/`archive`) is confusing. Instead, Focus Reader uses a single triage pipeline for everything. If a user wants to separate RSS/email content from manually saved content, they can use filtered views (Section 6.7) to create views like "RSS items in inbox" or "emails this week" — without needing a parallel organizational system.

The user can further organize documents by:
- **Starring** documents they want quick access to (shown in the "Starred" view).
- **Tagging** documents for topic-based organization.
- **Adding to collections** for curated reading lists.

#### 6.2.3 Document List Features

- **View mode toggle:** Switch between list view and grid view. The user's preference is persisted per-view (e.g., Inbox can be list view while a "Design Inspiration" tag view can be grid view).
- Sort by: saved date, published date, reading progress, reading time.
- Filter by: type, tag, source, read/unread, starred, location.
- Bulk actions: mark read/unread, star/unstar, tag, move to location, delete.
- Pagination: 50 documents per page with "Load more".

#### 6.2.4 Reading Experience

- Clean, distraction-free typography optimized for long-form reading.
- Configurable font family, font size, line height, and content width.
- Dark mode and light mode.
- Auto-mark as read after 1.5 seconds of focused visibility (configurable; manual toggle always available).
- Track reading progress (scroll position as percentage) and sync across sessions.
- Estimated reading time displayed in the document header.

### 6.3 Highlighting and Annotation

**Priority:** P1 (High)

**Description:** Select and save passages from any document, with optional notes and tags.

**Functional Requirements:**

- Select text in the reading pane to create a highlight.
- Choose highlight color (default: yellow; options: yellow, green, blue, purple, red).
- Add a note to any highlight.
- Tag individual highlights (separate from document-level tags).
- View all highlights for a document in a "Notebook" sidebar tab.
- View all highlights across all documents in a dedicated "Highlights" view (filterable by tag, document, date).
- Highlights are anchored to the content using a position selector (CSS selector + text offset) so they persist across content re-renders.
- Keyboard shortcut: `H` to highlight the focused paragraph; `N` to add a note to a highlight.

**PDF highlighting:**

- Support text selection and highlighting within the PDF viewer.
- Store highlight position using page number + character offset.

### 6.4 Keyboard Navigation

**Priority:** P1 (High)

**Description:** Comprehensive keyboard shortcuts for a mouse-free reading workflow.

| Shortcut       | Action                           |
|----------------|----------------------------------|
| `j` / `k`      | Next / previous document in list |
| `o` or `Enter` | Open selected document           |
| `Escape`       | Close reading pane / go back     |
| `h`            | Highlight focused paragraph      |
| `n`            | Add note to highlight            |
| `s`            | Star / unstar document           |
| `m`            | Toggle read / unread             |
| `e`            | Archive document                 |
| `f`            | Toggle focus mode                |
| `t`            | Open tag picker for document     |
| `a`            | Add URL dialog                   |
| `u`            | Upload file dialog               |
| `[` / `]`      | Toggle left / right sidebar      |
| `/`            | Focus search bar                 |
| `Cmd/Ctrl + K` | Command palette                  |
| `v`            | Toggle list / grid view          |
| `?`            | Show keyboard shortcut reference |

Keyboard shortcuts are disabled while focus is inside editable inputs (search bar, tag editor, note fields).

### 6.5 Tagging System

**Priority:** P1 (High)

**Description:** Flexible tagging for organizing documents, highlights, subscriptions, and feeds.

**Functional Requirements:**

- Create, edit, delete tags with name and color.
- Assign multiple tags to documents, highlights, subscriptions, and feeds.
- Documents from tagged subscriptions/feeds inherit those tags automatically.
- Filter any view by one or more tags.
- Auto-tagging rules: define rules per subscription/feed or globally based on sender domain, source domain, subject/title keywords, or content keywords.
- Tag management page: view all tags with document counts, edit, merge, delete.

### 6.6 Search

**Priority:** P1 (High)

**Description:** Full-text search across all saved content.

**Functional Requirements:**

- Search across: title, author, body content (plain text / markdown), tags, source name.
- Filter results by: document type, tag, source, date range, read/unread, starred, location.
- Return results ranked by relevance with highlighted matching snippets.
- Search within a specific document (Ctrl/Cmd + F style, but searching the clean content).

**Implementation:**

- D1/SQLite FTS5 for full-text indexing.
- Indexed fields: `title`, `author`, `plain_text_content`, `markdown_content`, and tag names.
- FTS index updates are part of the ingestion transaction.
- Search is introduced in Phase 2.

### 6.7 Filtered Views

**Priority:** P2 (Medium)

**Description:** Saved query-based views for custom document groupings.

**Functional Requirements:**

- Create saved views using a filter query language.
- Filter parameters: `type`, `tag`, `source`, `domain`, `author`, `location`, `is_read`, `is_starred`, `saved_after`, `saved_before`, `published_after`, `published_before`, `word_count_gt`, `word_count_lt`, `reading_time_gt`, `reading_time_lt`, `has:highlights`, `has:notes`.
- Combine filters with `AND`, `OR`, and parenthetical grouping.
- Saved views appear in the left sidebar for quick access.
- Default views: Inbox, Later, Archive, All, Starred, Recently Read, Newsletters (type = email), RSS (type = rss).

### 6.8 Collections

**Priority:** P2 (Medium)

**Description:** Curated, ordered groups of documents — like reading lists or playlists.

**Functional Requirements:**

- Create named collections with optional descriptions.
- Add documents to a collection from the document list or reading pane.
- Drag-and-drop reordering within a collection.
- Collections appear in the left sidebar.

### 6.9 Browser Extension

**Priority:** P1 (High)

**Description:** Browser extension for Chrome, Firefox, and Safari to save content to Focus Reader.

**Functional Requirements:**

- One-click save of the current page as an article.
- Option to save as bookmark (lightweight, no content extraction).
- Send the full page HTML to the server for best parsing fidelity (not just the URL).
- Show save confirmation with quick-tag picker.
- Keyboard shortcut to save (configurable, default: `Alt + Shift + S`).
- Badge indicator showing unread count (optional, configurable).

### 6.10 Subscription and Feed Management

**Priority:** P0 (Critical)

**Description:** Manage email subscriptions and RSS feed subscriptions.

**Email Subscriptions:**

> Detailed in the [Email Newsletter PRD](./email-newsletter-prd.md), Section 5.2.

- List all subscriptions with: display name, pseudo email, sender, tags, last received date, unread count.
- Create new subscriptions (generate a pseudo email address).
- Edit: rename, assign/remove tags, toggle active/inactive.
- Copy pseudo email to clipboard.
- Soft delete / hard delete with cascade.

**RSS Feeds:**

- List all feeds with: title, site URL, icon, tags, last fetched, item count, error status.
- Add feeds by URL or discover from a website URL.
- Edit: rename, assign/remove tags, toggle active/inactive, set fetch interval, toggle full content fetch.
- OPML import and export.
- Soft delete / hard delete with cascade.

### 6.11 RSS/Atom Feed Output

**Priority:** P3 (Low)

> Carried forward from the [Email Newsletter PRD](./email-newsletter-prd.md), Section 5.7, expanded to cover all document types.

**Description:** Expose saved documents as standard Atom feeds for consumption in external readers.

**Functional Requirements:**

- Generate Atom feeds per source, per tag, per collection, or combined "all".
- Feed endpoints on a separate hostname, not protected by Cloudflare Access.
- Authenticated by per-user opaque token (SHA-256 hashed in `Feed_Token` table).
- Token lifecycle: create, rotate, revoke via UI.

### 6.12 REST API

**Priority:** P2 (Medium)

**Description:** A single RESTful API that serves all clients — the web UI, the browser extension, and any third-party integrations or scripts.

> **Naming clarification:** This is *not* a "public" API in the sense that anyone on the internet can access it. Every endpoint requires authentication. We call it the "REST API" (not "public API" or "internal API") because there is only one API — the same endpoints are used by the web UI, the browser extension, and any external tools the user builds.

**Authentication:**

Every API request must be authenticated. There are no unauthenticated endpoints (except the RSS/Atom feed output, which uses its own token scheme — see Section 6.11). Two authentication methods are supported:

1. **Cloudflare Access session (web UI):** When the user accesses the app through the browser, Cloudflare Access provides a JWT cookie. The API validates this cookie on every request. This is transparent to the user.
2. **API key (extension + external clients):** For the browser extension and any programmatic access, the user generates API keys in the settings UI. Keys are sent via the `Authorization: Bearer <key>` header. Keys are stored as SHA-256 hashes in the database; the plaintext is shown once at creation and never persisted.

**Functional Requirements:**

- CRUD operations on documents, tags, highlights, collections, feeds, subscriptions.
- `POST /api/documents` — save a new document (URL, file upload, or raw content).
- `GET /api/documents` — list documents with full filter/sort/pagination support.
- `GET /api/documents/:id` — get a single document with its content.
- `PATCH /api/documents/:id` — update document metadata (tags, location, read status, etc.).
- `DELETE /api/documents/:id` — soft delete a document.
- `GET /api/highlights` — list highlights with filtering by document, tag, date.
- `POST /api/highlights` — create a highlight.
- CRUD operations on tags, collections, feeds, subscriptions.
- Rate limiting: 100 requests per minute per API key.

### 6.13 Import and Export

**Priority:** P2 (Medium)

**Description:** Import data from other reading apps and export Focus Reader data.

**Import support:**

- OPML (RSS feeds from other readers).
- CSV/JSON import from Instapaper, Pocket, and Omnivore (parse their export formats).
- Readwise export format (if available).

**Export support:**

- OPML export of all RSS feed subscriptions.
- Full data export as JSON (all documents, highlights, tags, collections).
- Highlights export as Markdown (grouped by document).
- **Single-document Markdown export:** Export any document as a standalone `.md` file with YAML frontmatter (title, author, URL, tags, saved date) and all highlights/notes inline. Designed for direct import into Obsidian, Logseq, or any Markdown-based note-taking app.
- **Bulk Markdown export:** Export all documents (or a filtered subset) as a folder of `.md` files, ready to drop into an Obsidian vault.
- **Copy as Markdown:** One-click action in the reading pane to copy the document's Markdown content to the clipboard (with or without highlights/notes).

### 6.14 Summarization (Optional / Future)

**Priority:** P3 (Low)

**Description:** AI-generated summaries for quick scanning.

**Functional Requirements:**

- On ingestion (or on demand), generate a 2–3 sentence summary of each document.
- Display summaries in the document list as an alternative to content previews.
- Generate daily/weekly digest summaries across all or tagged sources.
- AI copilot for in-context questions: summarize, explain, translate selected text.

### 6.15 Settings and Administration

**Priority:** P1 (High)

**Description:** Configuration interface for managing the Focus Reader instance.

**Settings pages:**

- **General:** Display preferences (theme, font, content width), default reading behavior.
- **Email:** Email domain configuration, denylist management, plus-alias collapsing toggle.
- **Feeds:** Default fetch interval, full content fetch default.
- **API keys:** Create, view, revoke API keys.
- **Feed tokens:** Create, view, revoke Atom feed tokens.
- **Import/Export:** Import from other apps, export data.
- **Keyboard shortcuts:** View and customize shortcuts.
- **Ingestion log:** View recent ingestion events with status, errors, and retry counts.
- **Reliability dashboard:** Success/failure rates over the prior 30 days (computed by a daily Cron Trigger).

---

## 7. Phased Rollout

### Phase 0 — Email Ingestion Proof of Concept

**Goal:** Validate that the email ingestion pipeline works end to end.

**Deliverables:**

- Cloudflare Email Worker configured with catch-all on subdomain.
- Worker parses inbound email, sanitizes HTML, converts to Markdown, and writes to D1.
- D1 schema for `Document`, `Document_Email_Meta`, `Subscription`, `Tag`, `Ingestion_Log`.
- No UI — verify via database inspection or API call.
- Subscribe to 2–3 real newsletters and confirm receipt and parsing.

**Success Criteria:** Emails from at least 3 different newsletter platforms are successfully received, parsed, and stored with clean HTML extraction.

### Phase 1 — Minimal Viable Reader

**Goal:** A functional reader for browsing saved newsletters and manually added articles.

**Deliverables:**

- Web UI with three-pane layout: sidebar, document list, reading pane.
- Email ingestion pipeline (from Phase 0) integrated with UI.
- Article saving via URL paste (Readability extraction).
- Bookmark saving via URL paste.
- Subscription management: view, rename, copy email address, assign tags.
- Basic tagging: create tags, assign to documents and subscriptions.
- Document triage: inbox / later / archive.
- Mark read/unread, star documents.
- Mobile-responsive layout.
- Focus mode.

**Success Criteria:** User can subscribe to newsletters, save articles by URL, and read them entirely through the Focus Reader UI.

### Phase 2 — RSS, Search, and Power Features

**Goal:** A refined daily-driver reading experience with RSS and full-text search.

**Deliverables:**

- RSS feed subscription and polling.
- OPML import/export.
- Full-text search (FTS5).
- Keyboard navigation (full shortcut set).
- Browser extension (Chrome).
- Auto-tagging rules.
- Filtered views (saved queries).
- PDF upload and viewing.
- Confirmation email detection and handling.
- REST API (core endpoints).
- Dark mode.

**Success Criteria:** User has fully migrated all newsletters and RSS feeds to Focus Reader and uses it as their primary reading app.

### Phase 3 — Polish and Advanced Features

**Goal:** Feature parity with commercial readers for power users.

**Deliverables:**

- Highlighting and annotation system.
- Highlight tags and notes.
- Notebook view (all highlights for a document).
- Collections (reading lists).
- Social media post saving (Twitter/X, Mastodon).
- Command palette (`Cmd+K`).
- Browser extensions for Firefox and Safari.
- Import from Instapaper, Pocket, Omnivore.
- Full data export (JSON, Markdown highlights).
- Reading progress tracking and sync.
- Customizable reading preferences (font, size, width, line height).

**Success Criteria:** User has fully replaced Readwise Reader with Focus Reader for daily use.

### Phase 4 — Intelligence Layer

**Goal:** AI-assisted organization and summarization.

**Deliverables:**

- Atom feed output (per source, per tag, combined).
- LLM-based auto-tagging on ingestion.
- Per-document summaries.
- Daily/weekly digest generation.
- AI copilot for in-context questions (summarize, explain, translate).
- Reliability dashboard and observability.

**Success Criteria:** User spends less time triaging and more time reading high-value content.

---

## 8. Technical Considerations

### 8.1 Content Parsing Reliability

- Web article extraction quality varies widely across sites. Use multiple strategies: Readability as primary, Open Graph / meta tags as fallback, full HTML as last resort.
- RSS feed formats are inconsistent. Handle malformed feeds gracefully — partial parses are better than failures.
- PDF text extraction is lossy for scanned documents. Phase 4 may add OCR support.

### 8.2 Email Deliverability and Reliability

> Detailed in the [Email Newsletter PRD](./email-newsletter-prd.md), Section 7.1.

- Ensure MX, SPF, DKIM, and DMARC records are correctly configured.
- Handle confirmation emails with `needs_confirmation` flag.
- Idempotent processing with `Message-ID` deduplication.
- Every ingestion attempt logged in `Ingestion_Log`.

### 8.3 Email HTML Challenges

> Detailed in the [Email Newsletter PRD](./email-newsletter-prd.md), Section 7.2.

- Strip tracking pixels and external scripts while preserving layout and legitimate images.
- Markdown conversion is lossy for complex layouts — HTML view is primary.

### 8.4 Storage and Costs

- At personal scale, storage is trivial and well within Cloudflare free tiers.
- D1 free tier: 5 GB — sufficient for thousands of documents.
- R2 free tier: 10 GB storage, 10 million reads/month — sufficient for PDF storage.
- Estimated annual storage: ~200 MB for text content + ~2 GB for PDFs (at moderate usage).
- Images are hotlinked from original sources by default. A local proxy/cache is a Phase 3 consideration.

### 8.5 Security

- **No unauthenticated endpoints.** Every HTTP endpoint requires authentication. There are zero anonymous API routes.
- **UI and API routes:** Protected by Cloudflare Access (zero-trust) for browser sessions, and by API key (Bearer token) for programmatic access. See Section 6.12 for details.
- **Email Worker:** Not a public HTTP route; triggered by Cloudflare's email routing infrastructure. Rate-limit and validate inbound messages.
- **Feed output endpoints:** The only exception to Cloudflare Access protection — served on a separate hostname so external RSS readers can fetch them. Authenticated by opaque token in the URL (see Section 6.11).
- **API keys:** Stored hashed (SHA-256). Plaintext shown once at creation, never again.
- **Content sanitization:** All ingested HTML is sanitized with DOMPurify before storage. No raw HTML is ever rendered.
- **CORS:** API endpoints include appropriate CORS headers for the browser extension.

### 8.6 Performance

- Document list pagination: 50 items per page to keep responses fast.
- FTS5 queries should return in <100ms for a personal-scale database.
- RSS polling is distributed across Cron Trigger intervals to avoid burst load.
- Image-heavy documents may load slowly on first render; consider lazy loading images in the reading pane.

---

## 9. Similar Apps and References

| Project                                              | Relevance                                               | Notes                                                            |
|------------------------------------------------------|---------------------------------------------------------|------------------------------------------------------------------|
| [Readwise Reader](https://readwise.io/read)          | Primary inspiration. Feature-complete commercial reader | Closed-source, subscription-based. Strongest UX reference.       |
| [Omnivore](https://github.com/omnivore-app/omnivore) | Open-source read-it-later with newsletter ingestion     | Acquired by ElevenLabs. Codebase available for reference.        |
| [Feedbin](https://feedbin.com)                       | RSS reader with newsletter email addresses              | Polished commercial product. Good reference for feed + email UX. |
| [Wallabag](https://wallabag.org)                     | Self-hosted read-it-later                               | PHP-based. Good reference for self-hosted article saving.        |
| [Miniflux](https://miniflux.app)                     | Minimalist self-hosted RSS reader                       | Go-based. Good reference for lightweight RSS architecture.       |
| [Hoarder](https://hoarder.app)                       | Self-hosted bookmark manager with AI tagging            | Good reference for bookmark saving and AI categorization.        |

---

## 10. Relationship to Email Newsletter PRD

The [Email Newsletter PRD](./email-newsletter-prd.md) is a detailed specification for the email ingestion subsystem. It remains the authoritative reference for:

- Email addressing strategy (Section 3.3)
- Email-specific data model fields (Section 4.1: `Subscription`, `Newsletter_Item` → mapped to `Document` + `Document_Email_Meta` in this spec)
- Email ingestion pipeline details (Section 5.1): parsing, sanitization, deduplication, validation, rejection, confirmation detection, retry policy
- Subscription management (Section 5.2)
- Email-specific reader interface features (Section 5.3)
- Email security considerations (Section 7)

This full product spec extends the scope from email-only to all content types, introducing the unified `Document` model, additional ingestion pipelines (web articles, RSS, PDF, bookmarks, posts), highlighting/annotation, collections, filtered views, browser extension, REST API, and import/export.

---

## 11. Success Metrics

- **Adoption:** 100% of newsletter subscriptions and RSS feeds migrated to Focus Reader within 60 days of Phase 2 launch.
- **Reliability:** ≥99% of inbound content (email + RSS) successfully ingested (measured over 30 days).
- **Engagement:** User opens Focus Reader at least 5x per week.
- **Inbox reduction:** Zero newsletter emails in the user's primary inbox; zero RSS reader tabs open.
- **Content consolidation:** ≥80% of the user's reading activity happens within Focus Reader.
- **Annotation usage:** User creates at least 10 highlights per week by Phase 3.
