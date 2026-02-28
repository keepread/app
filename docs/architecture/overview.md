# Focus Reader Architecture (Current Implementation)

This document describes the architecture currently implemented in the repository as of February 2026.

## System Overview

Focus Reader is a Cloudflare-native read-it-later platform with four runtime surfaces:

1. `apps/web` (Next.js 15 + OpenNext on Cloudflare Workers)
2. `apps/email-worker` (Cloudflare Email Worker for newsletter ingestion)
3. `apps/rss-worker` (Cloudflare Worker for scheduled feed polling + queue consumer)
4. `apps/extension` (WXT browser extension client)

Shared business logic and data access live in workspace packages:

- `packages/shared`: types, constants, utility logic
- `packages/db`: D1 schema + typed query helpers
- `packages/parser`: email/article/rss/pdf parsing and sanitization
- `packages/api`: business logic orchestrating parser + db

## Data Plane

Primary storage:

- `D1` (`FOCUS_DB`) for relational data and FTS5 search
- `R2` (`FOCUS_STORAGE`) for PDFs, attachments, and cached images

Queue:

- `EXTRACTION_QUEUE` for asynchronous content enrichment and cover image caching
- Produced by web + rss worker
- Consumed by rss worker queue handler

## Multi-Tenancy Model

User isolation is row-level and enforced by code shape:

- Primary entity tables include `user_id`
- Query/API functions consume `UserScopedDb` (`{ db, userId }`)
- `scopeDb(db, userId)` is required at call boundaries
- Cross-tenant operations are isolated in `packages/db/src/queries/admin.ts`
- Child entity queries (`email-meta`, `pdf-meta`, `attachments`) use raw `D1Database` and rely on parent document linkage

## Auth Architecture

Auth is mode-scoped via `AUTH_MODE`:

- `single-user`:
  - Optional Cloudflare Access JWT (`CF_Authorization`)
  - API key bearer auth
  - Fallback auto-auth to owner user when CF Access is not configured
- `multi-user`:
  - Better Auth session (`fr_session`) via magic-link flow
  - API key bearer auth

Resolution path:

1. Web layer `resolveAuthUser()` checks Better Auth session in multi-user mode
2. Falls through to shared `authenticateRequest()` for API key / single-user flows
3. API routes call `withAuth()` and receive `userId`

Server-rendered app routes use `resolveServerAuthState()` for redirects:

- Unauthenticated multi-user users -> `/login`
- Users without onboarding complete -> `/onboarding`

## Request and Worker Flows

### Web API Request

1. Route handler enters via `apps/web/src/app/api/.../route.ts`
2. `withAuth()` resolves `userId`
3. Route acquires bindings (`getDb`, `getR2`, optionally `getExtractionQueue`)
4. Route creates scoped context: `scopeDb(db, userId)`
5. Route calls `@focus-reader/api`
6. Response returned with standard JSON envelope and optional CORS handling

### Email Ingestion

1. Email worker receives `ForwardableEmailMessage`
2. Resolves target user and alias route from recipient address
3. Parses MIME and deduplicates by message ID / fingerprint
4. Sanitizes HTML, uploads CID attachments to R2, rewrites URLs
5. Converts to markdown, computes reading stats
6. Creates or resolves subscription
7. Creates document + metadata + attachment rows
8. Applies inherited/manual auto-tags and writes ingestion log

### RSS Polling and Enrichment

1. Scheduled trigger polls due feeds via admin query
2. Processes feed items per user-scoped context
3. Optionally attempts full-content extraction and metadata extraction
4. Creates rss documents and inherited tags
5. Enqueues low-quality extraction jobs and image cache jobs
6. Queue consumer performs:
   - Enrichment jobs via Browser Rendering API (when enabled)
   - Image cache jobs into R2

## UI Architecture

Reader app uses URL-driven state:

- Route identifies list context (`/inbox`, `/later`, `/tags`, etc.)
- `?doc=<id>` switches into reading view
- Sidebars, TOC, focus mode, and selected item state are in `AppContext`
- Data fetching uses SWR hooks against REST routes

For detailed architecture slices, see:

- `docs/architecture/auth-and-tenancy.md`
- `docs/architecture/rss-ingestion-and-queue.md`
- `docs/product/ui-spec-current.md`

## Operational Notes

- Build order matters: `pnpm build` before tests
- `vitest` pinned to `~3.2.0` due Cloudflare worker pool compatibility
- D1 foreign keys are not relied on for production integrity; app-level cascades are required
- Sanitization uses linkedom walker (no DOMPurify)
