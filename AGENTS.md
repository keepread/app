# Agents Guide

This document contains everything an AI agent needs to work effectively on the Focus Reader codebase.

## Project Overview

Focus Reader is a self-hosted read-it-later app deployed on Cloudflare (Workers, D1, R2, Pages). It ingests content from email newsletters, web articles, RSS feeds, and bookmarks into a unified reading interface.

**Current state:** Phase 0 (email ingestion) and Phase 1 (API + web UI) complete. Phase 2 (RSS, search, highlights) is next. See `agents/plans/phase-1-implementation-gaps.md` for remaining Phase 1 gaps deferred to Phase 2.

### Specification Documents

Detailed specs live in `agents/spec/` and implementation plans in `agents/plans/`:

- `agents/spec/focus-reader-prd.md` — Full product requirements (all entity schemas, features, non-goals)
- `agents/spec/email-newsletter-prd.md` — Email ingestion pipeline requirements
- `agents/spec/repo-structure.md` — Monorepo structure rationale and conventions
- `agents/spec/improvements.md` — Design improvements and open questions
- `agents/plans/phase-0-plan.md` — Phase 0 implementation plan (completed)
- `agents/plans/phase-1-plan.md` — Phase 1 implementation plan (completed)
- `agents/plans/phase-1-implementation-gaps.md` — Phase 1 gap tracker (open gaps deferred to Phase 2)

**Always read the relevant spec before implementing a feature.** The specs define entity schemas, validation rules, and edge cases.

## Repository Structure

```
focus-reader/
├── packages/
│   ├── shared/          # Types, constants, utilities (no deps)
│   ├── db/              # D1 migrations, typed query helpers
│   ├── parser/          # Email parsing, HTML sanitization, Markdown conversion
│   └── api/             # REST API business logic (documents, subscriptions, tags, denylist)
├── apps/
│   ├── email-worker/    # Cloudflare Email Worker
│   └── web/             # Next.js 15 frontend on Cloudflare Pages
├── scripts/
│   ├── sync-secrets.sh  # Propagate .dev.vars across workspaces
│   └── ingest-local.ts  # Local .eml testing helper
└── agents/
    ├── spec/            # Product requirement documents
    └── plans/           # Phase implementation plans
```

### Dependency Graph

```
shared ← db ← api ← email-worker
shared ← parser ←───┘       ↑
shared ← db ←───────────────┘
```

- `shared` has zero external dependencies
- `db` depends on `shared`
- `parser` depends on `shared`
- `api` depends on `shared`, `db`, `parser`
- `email-worker` depends on `shared`, `db`, `parser`
- `web` depends on `shared`, `db`, `parser`, `api`

## Build & Test Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (turbo, respects dependency order)
pnpm typecheck        # Type-check all packages
pnpm test             # Run all tests

# Per-package
pnpm --filter @focus-reader/shared test
pnpm --filter @focus-reader/db test
pnpm --filter @focus-reader/parser test
pnpm --filter focus-reader-email-worker test
```

**Always run `pnpm build` before `pnpm test`** — the test task depends on `^build` in turbo.json.

**Always verify with `pnpm build && pnpm typecheck && pnpm test` before committing.**

## Local Development

### Starting Dev Servers

```bash
# Terminal 1: Web app (Next.js on port 3000)
pnpm --filter focus-reader-web dev

# Terminal 2: Email worker (optional, for testing email ingestion)
pnpm --filter focus-reader-email-worker dev
```

Both apps share the same D1/R2 state via a shared persist path at the monorepo root: `.wrangler/state/v3/`.

### Shared Local D1/R2 State

The web app and email worker share Cloudflare D1 and R2 bindings during local development:

- **Web app:** `apps/web/next.config.ts` calls `initOpenNextCloudflareForDev()` with `persist: { path: "../../.wrangler/state/v3" }`. The `apps/web/wrangler.toml` configures D1/R2 bindings and `[miniflare]` persist paths pointing to the same shared location.
- **Email worker:** `apps/email-worker/package.json` dev script uses `--persist-to ../../.wrangler/state`.

This means documents ingested by the email worker appear immediately in the web app's UI.

### Applying Migrations

```bash
# Apply migrations to the shared local D1
pnpm --filter @focus-reader/db wrangler d1 migrations apply focus-reader-db --local
```

Or use the `wrangler.toml` in `apps/web/` or `apps/email-worker/` which both reference `migrations_dir = "../../packages/db/migrations"`.

## Code Conventions

### TypeScript

- **Target:** ES2022, ESNext modules, bundler module resolution
- **Strict mode** enabled globally via `tsconfig.base.json`
- Import paths use `.js` extensions (ESM convention): `import { foo } from "./bar.js"`
- No DOM lib in base config; `shared` and `parser` add DOM/DOM.Iterable in their own tsconfig

### Package Bundling

- Packages use **tsup** (ESM only, dts generation, es2022 target)
- Mark workspace dependencies as `external` in tsup.config.ts to avoid double-bundling
- `parser` also externalizes runtime deps: `postal-mime`, `linkedom`, `turndown`
- `email-worker` uses `wrangler` for bundling (not tsup)

### Exports

Each package has a barrel `src/index.ts` that re-exports everything. Package.json `exports` field maps to `dist/`:

```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  }
}
```

The `db` package has an additional export path for `./migration-sql` (embedded SQL for workerd tests).

### Entity Types

All entity interfaces live in `packages/shared/src/types.ts`. D1 conventions:
- `number` for booleans (0/1)
- `string` for timestamps (ISO 8601)
- `string` for UUIDs

Input types (e.g., `CreateDocumentInput`) have optional fields with defaults applied in query helpers.

`CreateDocumentInput.id` is optional — when provided, the caller controls the UUID (needed for pre-generating document IDs for CID image R2 paths).

### Query Helpers

All in `packages/db/src/queries/`. Every function takes `db: D1Database` as its first parameter (dependency injection). Uses prepared statements with `.bind()`.

### HTML Sanitization

Uses **linkedom** for DOM manipulation (NOT DOMPurify — it's incompatible with Workers). The sanitizer in `packages/parser/src/sanitize.ts`:
- Removes dangerous tags entirely (script, style, iframe, etc.)
- Unwraps non-allowed structural tags (html, body, header, nav, etc.) — promotes children
- Strips attributes not in the allowlist
- Strips `on*` event handler attributes
- Strips tracking pixels (1x1 images, known tracker domains)

### Markdown Conversion

Uses **turndown** with linkedom for DOM parsing (turndown needs a `document` to parse HTML, which doesn't exist in Workers). The `htmlToMarkdown` function pre-parses HTML with linkedom and passes the DOM node to turndown.

## Testing

### Test Frameworks

| Package        | Test Runner                                | Environment       |
|----------------|--------------------------------------------|-------------------|
| `shared`       | vitest                                     | Node.js           |
| `parser`       | vitest                                     | Node.js           |
| `db`           | vitest + `@cloudflare/vitest-pool-workers` | workerd (D1)      |
| `email-worker` | vitest + `@cloudflare/vitest-pool-workers` | workerd (D1 + R2) |

### Version Constraints

- **vitest** pinned to `~3.2.0` — `@cloudflare/vitest-pool-workers` does NOT support vitest 4.x
- **wrangler** `^4`
- **@cloudflare/vitest-pool-workers** `^0.12`

### Workerd Test Gotchas

1. **No filesystem reads** — `readFileSync` with `__dirname` paths fails in workerd. Embed data as module exports instead (see `packages/db/src/migration-sql.ts`).

2. **`db.exec()` bug** — `db.exec()` throws "Cannot read properties of undefined (reading 'duration')" in workerd. Use `db.prepare(stmt).run()` for individual statements.

3. **R2 isolated storage conflict** — `@cloudflare/vitest-pool-workers` isolated storage doesn't work with R2. The email-worker tests use `isolatedStorage: false` and manually clean up in `beforeEach`.

4. **Test file typecheck** — Test files importing `cloudflare:test` cause `tsc` errors. The `db` and `email-worker` tsconfigs exclude `src/__tests__` from typecheck (vitest handles type checking during test runs).

5. **EML fixtures in workerd tests** — Embed EML content as string constants in the test file, not as fixture files on disk.

6. **ReadableStream consumption** — Streams can only be read once. The email worker reads `message.raw` into an ArrayBuffer before the retry loop to avoid "stream already locked" errors on retry.

### Test Fixtures

- `packages/parser/fixtures/` — `.eml` files for parser unit tests (read via `readFileSync` in Node.js)
- `apps/email-worker/fixtures/` — `.eml` files (reference only; actual test data is embedded as string constants in the test file due to workerd limitations)

## Cloudflare Bindings

| Binding         | Type        | Used By                            |
|-----------------|-------------|------------------------------------|
| `FOCUS_DB`      | D1 Database | email-worker, web, db (migrations) |
| `FOCUS_STORAGE` | R2 Bucket   | email-worker, web                  |

Environment variables:
- `EMAIL_DOMAIN` — Catch-all email subdomain (e.g., `read.yourdomain.com`)
- `COLLAPSE_PLUS_ALIAS` — `"true"` or `"false"`, controls plus-alias collapsing

## Email Worker Pipeline

The email worker (`apps/email-worker/src/index.ts`) implements a 17-step pipeline:

1. Parse MIME (postal-mime)
2. Extract recipient / subscription key
3. Deduplicate (Message-ID, then SHA-256 fingerprint)
4. Validate (empty body, sender denylist)
5. Detect confirmation emails
6. Pre-generate document UUID (for CID image R2 paths)
7. Sanitize HTML (linkedom)
8. Upload CID images to R2
9. Rewrite CID URLs to proxy paths
10. Convert to Markdown (turndown)
11. Compute word count / reading time
12. Look up or auto-create subscription
13. Create Document in D1
14. Create EmailMeta (dedup keys, rejection/confirmation flags)
15. Create Attachment records
16. Inherit subscription tags
17. Log ingestion event

The outer handler wraps the pipeline in `withRetry(3, fn)` with exponential backoff. The raw stream is read once before the retry loop.

## Web App Architecture

The web app (`apps/web`) is a Next.js 15 App Router application deployed to Cloudflare Pages via `@opennextjs/cloudflare`.

### Stack

- **Framework:** Next.js 15 (App Router, React 19)
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york style, 16 components in `src/components/ui/`)
- **Data fetching:** SWR (client-side), `useSWRInfinite` for paginated lists
- **State:** URL search params (`?doc=<id>` for reading view), React context for UI state
- **Theming:** `next-themes` (light/dark/system), CSS variables with oklch colors

### Route Structure

```
app/
├── page.tsx                    # Redirects to /inbox
├── layout.tsx                  # Root: Inter font, ThemeProvider, Toaster
├── (reader)/                   # Reader layout group (AppProvider + SWRConfig + AppShell)
│   ├── layout.tsx
│   ├── inbox/page.tsx
│   ├── later/page.tsx
│   ├── archive/page.tsx
│   ├── all/page.tsx
│   ├── starred/page.tsx
│   ├── subscriptions/[id]/page.tsx
│   └── tags/[id]/page.tsx
├── settings/                   # Settings layout group
│   ├── layout.tsx
│   ├── page.tsx                # General (theme toggle)
│   ├── subscriptions/page.tsx
│   ├── denylist/page.tsx
│   ├── email/page.tsx          # Email domain display
│   └── ingestion-log/page.tsx  # Recent ingestion events table
└── api/                        # Next.js Route Handlers
    ├── documents/              # GET (list), POST (create bookmark)
    ├── documents/[id]/         # GET, PATCH, DELETE
    ├── documents/[id]/content/ # GET (HTML/markdown from R2)
    ├── documents/[id]/tags/    # POST, DELETE (tag/untag document)
    ├── subscriptions/          # GET, POST (create subscription)
    ├── subscriptions/[id]/     # PATCH, DELETE (?hard=true for cascade)
    ├── subscriptions/[id]/tags/ # POST, DELETE (tag/untag subscription)
    ├── tags/                   # GET, POST
    ├── tags/[id]/              # PATCH, DELETE
    ├── denylist/               # GET, POST
    ├── denylist/[id]/          # DELETE
    ├── settings/               # GET (returns emailDomain)
    └── ingestion-log/          # GET (recent ingestion events)
```

### Key Patterns

- **Two-mode layout:** `AppShell` switches between Library View (sidebar + document list + right panel) and Reading View (TOC + content + right panel) based on `?doc=` search param
- **API routes** use `getDb()`/`getR2()` from `src/lib/bindings.ts` to access Cloudflare D1/R2 bindings, then call into `@focus-reader/api` business logic
- **Client API calls** go through `apiFetch()` from `src/lib/api-client.ts` which handles JSON headers and error wrapping (`ApiClientError`)
- **Keyboard shortcuts** registered via `useKeyboardShortcuts` hook; respects input focus (disabled in inputs/textareas)
- **Article extraction** for bookmarks uses `@mozilla/readability` + linkedom in `packages/parser/src/article.ts`
- **No auth** in Phase 1 (single-user app). Auth middleware planned for Phase 2+

### Cloudflare Bindings (Web)

Access via `@opennextjs/cloudflare`'s `getCloudflareContext()`:

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
const { env } = await getCloudflareContext();
const db: D1Database = env.FOCUS_DB;
const r2: R2Bucket = env.FOCUS_STORAGE;
```

**Important:** For local dev, `getCloudflareContext()` requires:
1. `initOpenNextCloudflareForDev()` called in `apps/web/next.config.ts` (top-level, before the config export)
2. A `apps/web/wrangler.toml` with D1/R2 bindings configured

Without both, all API routes will return 500 errors because bindings are undefined.

### API Error Format

All API routes use a standardized error envelope:

```json
{ "error": { "code": "NOT_FOUND", "message": "Document not found" } }
```

Use `jsonError()` from `src/lib/api-helpers.ts` to create error responses. The client-side `apiFetch()` in `src/lib/api-client.ts` handles both old and new error formats.

## Common Pitfalls

- **linkedom in Workers:** Works, but DOMPurify + linkedom does NOT sanitize correctly. Always use the manual DOM tree walker in `sanitize.ts`.
- **turndown in Workers:** Requires pre-parsing HTML with linkedom and passing a DOM node, because there's no global `document` in Workers.
- **postal-mime content type:** `content` field on attachments is `string | ArrayBuffer`, not just `ArrayBuffer`. Handle both.
- **D1 foreign keys:** NOT enforced in production. Implement cascading deletes at the application level.
- **ContentID angle brackets:** postal-mime returns `contentId` with angle brackets (`<img001>`). Always strip with `.replace(/^<|>$/g, "")`.
- **Sanitizer and full HTML documents:** Email HTML from postal-mime often includes `<html><body>` tags. The sanitizer wraps input in its own `<body>`, so inner `<html>` tags get unwrapped (children promoted) rather than removed with their subtrees.
