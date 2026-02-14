# Specification Improvements: Focus Reader

This document outlines technical gaps and recommended improvements identified during the initial review of the Focus Reader and Email Newsletter PRDs.

## 1. Deployment & Orchestration
**Gap:** The PRDs describe multiple Cloudflare components (Pages, Email Workers, Cron Workers, D1, R2) but lack a unified deployment strategy.
**Improvement:** 
- Define a monorepo structure where the Next.js app (Pages), Email Worker, and Cron Worker can share a common D1/R2 client and schema definitions.
- Implement a `deploy.sh` or a shared `wrangler.toml` strategy (potentially using Service Bindings) to ensure the entire stack is provisioned as a single logical unit.

## 2. CID Image Persistence (Newsletters)
**Gap:** Phase 1 defers `cid:` (inline) image handling, which will lead to broken visuals in many professional newsletters.
**Improvement:** 
- Move R2 binary storage for inline email images from Phase 2 to Phase 1. 
- During ingestion, the Email Worker should parse MIME parts, upload `cid` attachments to R2, and rewrite the `src` in the stored HTML to point to a local proxy endpoint (e.g., `/api/proxy/image?key=...`).

## 3. Data Integrity & Backup
**Gap:** No defined strategy for backing up the D1 database and R2 assets.
**Improvement:**
- Add a scheduled Cron Worker task that performs a `D1 export` to R2 weekly.
- Provide a "Full Export" button in the Settings UI that bundles the D1 SQLite file and R2 assets into a downloadable archive.

## 4. Scraper Resilience (Social Media)
**Gap:** Platforms like X (Twitter) have aggressive anti-scraping measures that Cloudflare Workers cannot bypass natively.
**Improvement:**
- Explicitly define the use of a "Readability Proxy" or a specialized social media parser (like `fxtwitter` or similar open-source mirrors) for `post` type documents.
- Document that social media extraction is "best-effort" and may require the user to provide their own API keys for specific platforms in the Settings UI.

## 5. Scalable RSS Polling
**Gap:** Sequential polling of numerous RSS feeds in a single Cron Worker may exceed the 30-second execution limit.
**Improvement:**
- Implement a "Queue-based Fetch" architecture. The Cron Worker should push "Fetch Job" messages to a **Cloudflare Queue**, which then triggers a worker to process individual feeds in parallel.

## 6. Robust Highlight Anchoring
**Gap:** Highlights may "drift" or fail to render if the HTML sanitization logic or reader CSS changes.
**Improvement:**
- Adopt the **W3C Web Annotation Data Model**.
- Store multiple selectors for every highlight: `TextQuoteSelector` (the exact text), `TextPositionSelector` (offsets), and `CssSelector` as a fallback. This ensures the highlight remains findable even if the DOM structure changes slightly.

## 7. Administrative Bootstrap
**Gap:** Missing "First Run" logic to associate a Cloudflare Access user with the system owner.
**Improvement:**
- Define an `OWNER_EMAIL` environment variable in the Cloudflare Dashboard. 
- On the first login via Cloudflare Access, the system must verify that the `email` claim in the JWT matches `OWNER_EMAIL` before granting administrative access to D1 and settings.

## 8. Search Indexing Strategy
**Gap:** FTS5 indexing is planned for Phase 2 but lacks a "re-indexing" strategy for existing content.
**Improvement:**
- Add a "Rebuild Search Index" utility in the Admin UI to handle schema changes or index corruption without data loss.
- Ensure the ingestion pipeline uses a database transaction to keep the `Document` table and FTS5 index in sync.

## 9. API Key Schema Completeness
**Gap:** The PRD requires API key authentication and lifecycle management in settings, but the canonical data model does not define an `API_Key` table or equivalent fields.
**Improvement:**
- Add an `API_Key` entity to the canonical schema with hashed token storage and lifecycle metadata.
- Define required fields: `id`, `key_hash`, `label`, `last_used_at`, `created_at`, `revoked_at`.
- Document one-time plaintext display behavior and key prefix format for user identification.

## 10. Feed Full-Content Fetch Schema Mismatch
**Gap:** Feed features/settings require per-feed `fetch_full_content` behavior, but the `Feed` schema does not include a field to persist it.
**Improvement:**
- Add `fetch_full_content` (boolean) to the `Feed` table with a default value.
- Define precedence rules between global default (settings) and per-feed override.
- Include migration/backfill behavior for existing feeds.

## 11. Saved Filtered Views Persistence
**Gap:** Saved query-based filtered views are a defined feature, but no table exists to store view definitions, query expressions, ordering, and visibility in the sidebar.
**Improvement:**
- Add a `Saved_View` table (or equivalent) with `id`, `name`, `query`, `sort`, `pinned_order`, `created_at`, `updated_at`.
- Define query validation and versioning semantics so future filter grammar changes remain backward-compatible.
- Clarify whether default views are system-defined only or user-editable copies.

## 12. User Preferences Persistence Model
**Gap:** The PRD includes customizable reading and UI behavior (theme, fonts, shortcuts, list/grid preferences), but there is no canonical persistence model for settings.
**Improvement:**
- Add a `User_Preferences` table (single-user row in v1) for display, reading, keyboard, and view-mode preferences.
- Define which preferences are global vs per-view (e.g., list/grid mode by location/tag view).
- Specify reset-to-default behavior and migration strategy when preference keys change.

## 13. Reliability Report Storage Definition
**Gap:** The email PRD requires a daily reliability report written by Cron, but no reports table is defined in the canonical data model.
**Improvement:**
- Add an `Ingestion_Report_Daily` (or similar) table with `date`, success/failure counts, success rate, and rolling-window aggregates.
- Define recomputation and idempotency behavior when Cron runs multiple times for the same date.
- Clarify retention policy for historical reliability reports.

## 14. Public Collections vs Security Model Conflict
**Gap:** `Collection.is_public` implies anonymous/public sharing, but the security section says no unauthenticated endpoints except tokenized feed output.
**Improvement:**
- Resolve by selecting one explicit direction:
  - Remove `is_public` from v1 and defer public collections, or
  - Define authenticated/public collection access with explicit endpoint and token model.
- Ensure the chosen direction is reflected in schema, API requirements, and phase rollout.

## 15. Cross-PRD Roadmap and Priority Drift
**Gap:** Feed output timing and priority are inconsistent between PRDs (e.g., P4/Phase 3 in email PRD vs P3/Phase 4 in focus PRD).
**Improvement:**
- Establish a single source-of-truth roadmap matrix for shared features and reference it from both PRDs.
- Add a "cross-doc consistency check" checklist item for any milestone or priority changes.
- Update version/date headers and add a short changelog section to both PRDs.

## 16. `source_type` Enum Overload
**Gap:** `source_type` is used with different meanings/enums across tables (`Document.source_type` vs `Ingestion_Log.source_type`), increasing implementation risk.
**Improvement:**
- Rename fields for semantic clarity (e.g., `Document.origin_type` and `Ingestion_Log.channel_type`) or define strict enum namespaces.
- Document allowed values for each field in one canonical enum section.
- Add schema-level constraints (`CHECK`) to prevent invalid enum values.

## Proposed Solutions

### S1. Deployment & Orchestration (Monorepo & Service Bindings)
Use a monorepo structure with shared packages for D1/R2 clients and TypeScript types. 
- **Structure:** `/apps/web` (Next.js), `/apps/email-worker`, and `/apps/cron-worker`.
- **Communication:** Use **Cloudflare Service Bindings** to allow the Next.js app to trigger manual ingestions or fetch logs from the other workers without exposing them to the public internet.

### S2. CID Image Handling (R2 Proxy)
During `postal-mime` parsing in the Email Worker:
- Extract all attachments with a `contentId`.
- Upload the buffer to R2 using the key format `attachments/${document_id}/${content_id}`.
- Use a regular expression to replace `src="cid:${content_id}"` in the email HTML with a proxy URL: `/api/proxy/image?docId=${document_id}&contentId=${content_id}`.
- Implement the proxy endpoint in the Next.js app to fetch from R2 and serve with appropriate cache headers.

### S3. Data Integrity (R2 Scheduled Dumps)
Implement a "Backup Worker" or a Cron Trigger in the main worker:
- **Database:** Since D1 doesn't have a native "in-worker export" API, use a Cron Trigger to iterate through all tables in 1,000-row chunks and write a compressed JSON dump to a `/backups/db/${timestamp}.json.gz` folder in R2.
- **UI:** Add a "Download Backup" button that triggers a Worker to stream a ZIP file of the latest R2 dump directly to the user.

### S4. Scraper Resilience (Parser Fallbacks)
Define a tiered extraction strategy for `article` and `post` types:
1. **Tier 1 (Native):** Standard `fetch` + `@mozilla/readability`.
2. **Tier 2 (Proxy):** If Tier 1 fails (e.g., 403 Forbidden), route the request through a rotating proxy or a specialized frontend (e.g., Nitter for X, or a dedicated "browserless" service).
3. **Tier 3 (User-Assisted):** Allow the browser extension to send the "DOM Snapshot" (the fully rendered HTML) directly to the API, bypassing the need for the server to fetch the URL.

### S5. Scalable RSS (Cloudflare Queues)
Decouple discovery from processing:
- **Producer (Cron Worker):** Queries D1 for feeds that are due for polling and pushes a message `{ feedId: "..." }` to a **Cloudflare Queue**.
- **Consumer (Ingestion Worker):** Listens to the Queue and processes feeds in parallel (up to the configured concurrency limit), preventing any single long-running fetch from timing out the entire cron event.

### S6. Robust Anchoring (W3C Web Annotation)
Implement the **W3C Web Annotation Data Model** for highlights:
- Store a JSON object in `position_selector` containing:
  - `TextQuoteSelector`: The `exact` text, plus `prefix` and `suffix` context (to handle duplicate strings).
  - `TextPositionSelector`: Character `start` and `end` offsets.
- Use a client-side library to "re-discover" the highlight on render. If offsets fail, fall back to the quote selector to find the nearest match.

### S7. Administrative Bootstrap (Owner Environment Variable)
- **Config:** Set `OWNER_EMAIL` as a secret in the Cloudflare Dashboard.
- **Middleware:** In the Next.js `middleware.ts`, verify the `email` claim in the `Cf-Access-Jwt-Assertion` header. 
- **Logic:** If `payload.email === env.OWNER_EMAIL`, set an `is_admin` flag in the session. On the first login, if no user exists in D1, auto-create the owner profile.

### S8. Search Indexing (Transactional Sync & Batched Rebuild)
- **Sync:** Wrap all ingestion logic in a D1 transaction: `BEGIN;` -> Insert Document -> Insert FTS5 -> `COMMIT;`.
- **Rebuild:** Implement a background task that performs `INSERT INTO documents_fts(rowid, title, content) SELECT id, title, plain_text_content FROM documents`. Use `LIMIT` and `OFFSET` in the rebuild script to prevent memory exhaustion for large libraries.

### S9. API Key Schema (Canonical Table + Lifecycle)
Add a canonical `API_Key` table to the Focus Reader PRD schema:
- **Fields:** `id (UUID)`, `key_hash (unique SHA-256)`, `key_prefix`, `label`, `created_at`, `last_used_at`, `revoked_at`.
- **Behavior:** Generate a random opaque key, display plaintext once, store only hash + prefix.
- **Ops:** Add indexed lookup on `key_hash` and a revocation check in API auth middleware.

### S10. Feed Full-Content Fetch (Schema + Precedence)
Extend the `Feed` schema and settings contract:
- Add `fetch_full_content INTEGER (bool) NOT NULL DEFAULT 0` to `Feed`.
- Add `default_fetch_full_content` in global settings.
- Runtime precedence: `Feed.fetch_full_content` override -> global default.

### S11. Saved Views (Model + Query Contract)
Introduce `Saved_View` as a first-class entity:
- **Fields:** `id`, `name`, `query_ast_json`, `sort_json`, `pinned_order`, `created_at`, `updated_at`, `deleted_at`.
- **Validation:** Parse and persist normalized AST (not raw user strings) to reduce parser drift risk.
- **UX:** Keep built-in views immutable; allow user-created views and optional user-defined clones of defaults.

### S12. User Preferences (Single-User Settings Store)
Add a `User_Preferences` table for v1 single-user mode:
- **Fields:** `id`, `theme`, `font_family`, `font_size`, `line_height`, `content_width`, `shortcut_map_json`, `view_mode_prefs_json`, `updated_at`.
- **Scope:** Store both global defaults and per-view overrides.
- **Migration:** Version preference payloads with `schema_version` for forward compatibility.

### S13. Reliability Reports (Canonical Aggregates)
Create `Ingestion_Report_Daily` and align both PRDs to it:
- **Fields:** `report_date`, `total_events`, `success_count`, `failure_count`, `success_rate`, `window_days`, `computed_at`.
- **Idempotency:** Upsert by `report_date` and recompute from `Ingestion_Log` when rerun.
- **Retention:** Keep daily reports indefinitely (or define a fixed retention window explicitly).

### S14. Public Collections Security Decision
Choose one v1 path and codify it:
1. **Recommended (simpler):** Drop `is_public` from v1 schema and postpone shared/public collections.
2. **Alternative:** Keep `is_public` but require signed share tokens and separate read-only endpoints with explicit revocation.

### S15. Cross-PRD Consistency Guardrail
Add a lightweight governance process:
- Maintain a shared "Feature Matrix" section listing `priority + phase + owner PRD` for cross-cutting features.
- Require any change to shared features to update both PRDs in the same commit.
- Add `Last Updated` and `Changes Since vX.Y` sections for traceable evolution.

### S16. Enum Namespace Clarification (`source_type`)
Disambiguate ingestion origin vs event channel:
- Rename `Document.source_type` -> `origin_type` (`subscription|feed|manual`).
- Rename `Ingestion_Log.source_type` -> `channel_type` (`email|rss|api|extension`).
- Enforce constraints with `CHECK` clauses and centralize enum definitions in one schema glossary section.
