# Agents Guide

This document contains everything an AI agent needs to work effectively on the Focus Reader codebase.

## Project Overview

Focus Reader is a self-hosted read-it-later app deployed on Cloudflare (Workers, D1, R2, Pages). It ingests content from email newsletters, web articles, RSS feeds, and bookmarks into a unified reading interface.

**Current state:** Phase 0 complete (email ingestion pipeline). Phase 1 (API + web UI) is next.

### Specification Documents

Detailed specs live in `agents/spec/` and implementation plans in `agents/plans/`:

- `agents/spec/focus-reader-prd.md` — Full product requirements (all entity schemas, features, non-goals)
- `agents/spec/email-newsletter-prd.md` — Email ingestion pipeline requirements
- `agents/spec/repo-structure.md` — Monorepo structure rationale and conventions
- `agents/spec/improvements.md` — Design improvements and open questions
- `agents/plans/phase-0-plan.md` — Phase 0 implementation plan (completed)
- `agents/plans/phase-1-plan.md` — Phase 1 implementation plan (next)

**Always read the relevant spec before implementing a feature.** The specs define entity schemas, validation rules, and edge cases.

## Repository Structure

```
focus-reader/
├── packages/
│   ├── shared/          # Types, constants, utilities (no deps)
│   ├── db/              # D1 migrations, typed query helpers
│   ├── parser/          # Email parsing, HTML sanitization, Markdown conversion
│   └── api/             # REST API business logic (Phase 1, empty shell)
├── apps/
│   ├── email-worker/    # Cloudflare Email Worker
│   └── web/             # Next.js frontend (Phase 1, minimal shell)
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

| Package | Test Runner | Environment |
|---------|------------|-------------|
| `shared` | vitest | Node.js |
| `parser` | vitest | Node.js |
| `db` | vitest + `@cloudflare/vitest-pool-workers` | workerd (D1) |
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

| Binding | Type | Used By |
|---------|------|---------|
| `FOCUS_DB` | D1 Database | email-worker, db (migrations) |
| `FOCUS_STORAGE` | R2 Bucket | email-worker |

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

## Common Pitfalls

- **linkedom in Workers:** Works, but DOMPurify + linkedom does NOT sanitize correctly. Always use the manual DOM tree walker in `sanitize.ts`.
- **turndown in Workers:** Requires pre-parsing HTML with linkedom and passing a DOM node, because there's no global `document` in Workers.
- **postal-mime content type:** `content` field on attachments is `string | ArrayBuffer`, not just `ArrayBuffer`. Handle both.
- **D1 foreign keys:** NOT enforced in production. Implement cascading deletes at the application level.
- **ContentID angle brackets:** postal-mime returns `contentId` with angle brackets (`<img001>`). Always strip with `.replace(/^<|>$/g, "")`.
- **Sanitizer and full HTML documents:** Email HTML from postal-mime often includes `<html><body>` tags. The sanitizer wraps input in its own `<body>`, so inner `<html>` tags get unwrapped (children promoted) rather than removed with their subtrees.
