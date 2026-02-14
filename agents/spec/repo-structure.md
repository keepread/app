# Repository Structure Specification: Focus Reader Monorepo

**Version:** 1.0
**Date:** February 13, 2026
**Status:** Draft

---

## 1. Overview

This document specifies the monorepo structure for Focus Reader, a self-hosted read-it-later application deployed on Cloudflare's platform. The repository uses **PNPM workspaces** for dependency management and **Turborepo** for task orchestration.

### 1.1 Why a Monorepo

Focus Reader comprises multiple deployable units (Next.js web app, Email Worker, RSS Worker, browser extension) that share significant code: database schema, content parsing, HTML sanitization, API business logic, and TypeScript types. A monorepo ensures:

- **Single source of truth** for shared logic — no version drift between packages.
- **Atomic changes** — a schema migration and its corresponding query/UI changes land in one commit.
- **Simplified CI/CD** — one pipeline builds, tests, and deploys all affected apps.

### 1.2 Why PNPM Workspaces

- **Strict dependency isolation:** PNPM's non-flat `node_modules` structure prevents phantom dependencies — packages can only import what they explicitly declare in their `package.json`. This catches missing dependency declarations before deployment.
- **Efficient storage:** Content-addressable store with hard links means shared dependencies (e.g., `typescript`, `wrangler`) are stored once on disk regardless of how many workspaces use them.
- **Workspace protocol:** Internal packages reference each other via `"workspace:*"`, which PNPM resolves to the local source. No `npm link` hacks or manual version bumping.
- **Turborepo compatibility:** Turborepo natively understands PNPM workspaces for dependency graph resolution and task scheduling.

### 1.3 Why Turborepo

- **Task orchestration:** Builds packages in dependency order (e.g., `@focus-reader/shared` before `@focus-reader/db` before `apps/web`).
- **Remote caching:** Cached build artifacts avoid redundant work in CI and across developers.
- **Parallel execution:** Independent tasks (e.g., linting `apps/web` and `apps/email-worker`) run concurrently.
- **Lightweight:** Minimal configuration compared to Nx. Well-suited to the TypeScript/Cloudflare ecosystem.

---

## 2. Directory Layout

```
focus-reader/
├── apps/
│   ├── web/                        # Next.js app on Cloudflare Pages
│   ├── email-worker/               # Cloudflare Email Worker
│   ├── rss-worker/                 # Cloudflare Worker (Cron Triggers)
│   └── extension/                  # Browser extension (Chrome, Firefox, Safari)
├── packages/
│   ├── shared/                     # Common types, constants, utilities
│   ├── db/                         # D1 schema, migrations, query helpers
│   ├── parser/                     # Content parsing & sanitization
│   └── api/                        # Shared API route handlers / business logic
├── agents/
│   └── spec/                       # PRD and specification documents
├── pnpm-workspace.yaml
├── package.json                    # Root workspace config
├── turbo.json                      # Turborepo pipeline config
├── tsconfig.base.json              # Shared TypeScript compiler options
├── .npmrc                          # PNPM configuration
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD pipeline
└── LICENSE
```

---

## 3. Root Configuration Files

### 3.1 `pnpm-workspace.yaml`

Defines which directories are workspaces.

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3.2 `.npmrc`

PNPM-specific settings.

```ini
# Enforce strict peer dependency resolution
strict-peer-dependencies=true

# Hoist only tooling binaries needed at the root (turbo, prettier, eslint)
# Prevent phantom dependency access in workspace packages
shamefully-hoist=false

# Prefer frozen lockfile in CI
frozen-lockfile=true
```

### 3.3 Root `package.json`

The root `package.json` defines workspace-wide scripts and shared dev dependencies. It does not contain application code.

```jsonc
{
  "name": "focus-reader",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "db:migrate": "turbo run db:migrate --filter=@focus-reader/db",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.x",
    "typescript": "^5.x",
    "prettier": "^3.x",
    "eslint": "^9.x"
  },
  "packageManager": "pnpm@9.x.x",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 3.4 `turbo.json`

Defines the task dependency graph. Turborepo uses this to determine build order, caching, and parallelism.

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "db:migrate": {
      "cache": false,
      "outputs": []
    },
    "clean": {
      "cache": false,
      "outputs": []
    }
  }
}
```

> **`^build` dependency:** The `^` prefix means "run `build` in all workspace dependencies first." This ensures `packages/shared` builds before `packages/db`, and `packages/db` builds before `apps/web`.

### 3.5 `tsconfig.base.json`

Shared compiler options inherited by all workspaces.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist"]
}
```

> **`"lib": ["ES2022"]` — no DOM:** Packages targeting the Workers runtime must not include `"DOM"` in `lib`. The `apps/web` and `apps/extension` workspaces add `"DOM"` in their own `tsconfig.json`. The `packages/parser` workspace adds `"DOM"` only because it uses `linkedom` to shim the DOM for DOMPurify — but it never runs in a real browser DOM.

---

## 4. Shared Packages (`packages/`)

Shared packages use the `@focus-reader/` npm scope. They are never published to a registry — they are consumed exclusively via PNPM's `workspace:*` protocol.

### 4.1 `packages/shared` — Common Types, Constants, Utilities

**Package name:** `@focus-reader/shared`

The foundation package with zero heavy dependencies. All other packages depend on it.

```
packages/shared/
├── src/
│   ├── types.ts              # TypeScript types for all entities (Document, Subscription, Feed, Tag, etc.)
│   ├── constants.ts          # Document types, triage locations, source types, defaults
│   ├── url.ts                # URL normalization (strip utm_*, fbclid, etc.)
│   ├── slug.ts               # Slug decoding for email local parts (morning-brew → Morning Brew)
│   ├── time.ts               # ISO 8601 helpers, reading time estimation
│   └── index.ts              # Barrel export
├── tsconfig.json             # Extends ../../tsconfig.base.json
└── package.json
```

**Dependencies:** None (utility-only).

**Depended on by:** All other packages and apps.

### 4.2 `packages/db` — Database Schema, Migrations, Query Helpers

**Package name:** `@focus-reader/db`

Single source of truth for the D1 database. Contains SQL migrations, typed query builders, and schema constants. All database access across all apps goes through this package.

```
packages/db/
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_fts5_indexes.sql          # Phase 2
│   └── ...
├── src/
│   ├── schema.ts              # Table/column name constants, type guards
│   ├── queries/
│   │   ├── documents.ts       # CRUD + list/filter/paginate for Document
│   │   ├── email-meta.ts      # Document_Email_Meta queries
│   │   ├── pdf-meta.ts        # Document_PDF_Meta queries
│   │   ├── subscriptions.ts   # Subscription CRUD
│   │   ├── feeds.ts           # Feed CRUD
│   │   ├── tags.ts            # Tag CRUD + join table management
│   │   ├── highlights.ts      # Highlight CRUD
│   │   ├── collections.ts     # Collection CRUD + ordering
│   │   ├── ingestion-log.ts   # Ingestion logging
│   │   ├── denylist.ts        # Denylist CRUD
│   │   └── feed-tokens.ts     # Feed token CRUD
│   ├── migrate.ts             # Migration runner utility
│   └── index.ts               # Barrel export
├── tsconfig.json
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`)

**Key design decisions:**
- Queries accept a D1 database binding as a parameter (dependency injection), so they work in any Cloudflare Worker or Next.js API route.
- No ORM — raw SQL via D1's prepared statement API for transparency and performance.
- Migrations are plain SQL files, run via `wrangler d1 migrations apply` during deployment.

### 4.3 `packages/parser` — Content Parsing & Sanitization

**Package name:** `@focus-reader/parser`

All content ingestion logic: email parsing, article extraction, RSS feed parsing, HTML sanitization, and Markdown conversion. Designed to run in the Cloudflare Workers runtime (no Node.js-only APIs).

```
packages/parser/
├── src/
│   ├── email/
│   │   ├── parse.ts           # postal-mime MIME parsing
│   │   ├── dedup.ts           # Message-ID + fingerprint deduplication
│   │   ├── validate.ts        # Rejection rules (empty body, denylist, spam)
│   │   ├── confirm.ts         # Confirmation email detection
│   │   └── index.ts
│   ├── article/
│   │   ├── extract.ts         # Readability-based content extraction
│   │   ├── metadata.ts        # Open Graph / meta tag fallback extraction
│   │   └── index.ts
│   ├── rss/
│   │   ├── fetch.ts           # RSS/Atom/JSON Feed fetching and parsing
│   │   ├── opml.ts            # OPML import/export
│   │   └── index.ts
│   ├── sanitize.ts            # DOMPurify + linkedom HTML sanitization
│   ├── markdown.ts            # Turndown HTML → Markdown conversion
│   ├── attachments.ts         # MIME attachment metadata extraction
│   └── index.ts               # Barrel export
├── tsconfig.json
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`)
- `postal-mime` — MIME email parsing (Workers-compatible)
- `@mozilla/readability` — Article content extraction
- `linkedom` — DOM shim for Workers
- `dompurify` — HTML sanitization
- `turndown` — HTML to Markdown conversion

### 4.4 `packages/api` — Shared API Business Logic

**Package name:** `@focus-reader/api`

Business logic for all API operations, extracted from route handlers so it can be tested independently and shared between the Next.js API routes and any future API surface.

```
packages/api/
├── src/
│   ├── documents.ts           # Create, read, update, delete, list, filter, triage
│   ├── subscriptions.ts       # Subscription management
│   ├── feeds.ts               # Feed management, OPML operations
│   ├── tags.ts                # Tag CRUD, auto-tagging rule evaluation
│   ├── highlights.ts          # Highlight CRUD
│   ├── collections.ts         # Collection management
│   ├── search.ts              # FTS5 search interface
│   ├── import-export.ts       # Import (OPML, CSV, JSON) / Export (JSON, Markdown)
│   ├── auth.ts                # API key validation, Cloudflare Access JWT verification
│   └── index.ts               # Barrel export
├── tsconfig.json
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`)
- `@focus-reader/db` (`workspace:*`)
- `@focus-reader/parser` (`workspace:*`)

---

## 5. Applications (`apps/`)

### 5.1 `apps/web` — Next.js Web Application

The primary user interface, deployed to Cloudflare Pages via `@cloudflare/next-on-pages`.

```
apps/web/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (theme, sidebar shell)
│   ├── page.tsx                # Redirect to /inbox
│   ├── (reader)/               # Reader route group
│   │   ├── layout.tsx          # Three-pane layout shell
│   │   ├── inbox/
│   │   ├── later/
│   │   ├── archive/
│   │   ├── starred/
│   │   ├── all/
│   │   ├── subscriptions/
│   │   │   └── [id]/
│   │   ├── feeds/
│   │   │   └── [id]/
│   │   ├── tags/
│   │   │   └── [id]/
│   │   ├── collections/
│   │   │   └── [id]/
│   │   └── documents/
│   │       └── [id]/           # Full-screen document view / focus mode
│   ├── settings/               # Settings pages
│   │   ├── general/
│   │   ├── email/
│   │   ├── feeds/
│   │   ├── api-keys/
│   │   ├── feed-tokens/
│   │   ├── import-export/
│   │   ├── shortcuts/
│   │   └── ingestion-log/
│   └── api/                    # API route handlers (thin wrappers around @focus-reader/api)
│       ├── documents/
│       │   ├── route.ts        # GET (list), POST (create)
│       │   └── [id]/
│       │       └── route.ts    # GET, PATCH, DELETE
│       ├── highlights/
│       ├── tags/
│       ├── collections/
│       ├── feeds/
│       ├── subscriptions/
│       ├── search/
│       ├── import/
│       ├── export/
│       └── auth/
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx         # Left navigation sidebar
│   │   ├── document-list.tsx   # Center pane (list + grid views)
│   │   └── reading-pane.tsx    # Right pane (document reader)
│   ├── documents/
│   │   ├── document-card.tsx   # Grid view card
│   │   ├── document-row.tsx    # List view row
│   │   └── document-reader.tsx # Content renderer (HTML/Markdown/PDF)
│   ├── highlights/
│   ├── tags/
│   ├── collections/
│   ├── search/
│   ├── settings/
│   └── ui/                     # Shared UI primitives (buttons, inputs, modals, etc.)
├── hooks/                      # React hooks (keyboard shortcuts, reading progress, etc.)
├── lib/                        # Client-side utilities (API client, theme, preferences)
├── public/
├── styles/
├── wrangler.toml               # Cloudflare Pages bindings (D1, R2)
├── next.config.mjs
├── tsconfig.json               # Extends ../../tsconfig.base.json, adds "DOM" to lib
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`)
- `@focus-reader/db` (`workspace:*`)
- `@focus-reader/api` (`workspace:*`)
- `@focus-reader/parser` (`workspace:*`) — for client-side Markdown rendering if needed
- `next`, `react`, `react-dom`
- `@cloudflare/next-on-pages`

### 5.2 `apps/email-worker` — Cloudflare Email Worker

Handles inbound email via Cloudflare Email Routing. Minimal glue code — delegates to `@focus-reader/parser` and `@focus-reader/db`.

```
apps/email-worker/
├── src/
│   └── index.ts                # email() handler: parse → validate → store
├── wrangler.toml               # Email routing config, D1/R2 bindings
├── tsconfig.json
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`)
- `@focus-reader/db` (`workspace:*`)
- `@focus-reader/parser` (`workspace:*`)

**`wrangler.toml` bindings:**
- `D1`: `FOCUS_DB` — shared database
- `R2`: `FOCUS_STORAGE` — binary storage (Phase 2 attachments)

### 5.3 `apps/rss-worker` — Cloudflare Cron Worker

Polls RSS/Atom feeds on a schedule. Triggered by Cloudflare Cron Triggers.

```
apps/rss-worker/
├── src/
│   └── index.ts                # scheduled() handler: fetch feeds → parse → store
├── wrangler.toml               # Cron trigger config, D1 binding
├── tsconfig.json
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`)
- `@focus-reader/db` (`workspace:*`)
- `@focus-reader/parser` (`workspace:*`)

**`wrangler.toml` bindings:**
- `D1`: `FOCUS_DB` — shared database
- Cron trigger: e.g., `*/15 * * * *` (every 15 minutes; the worker checks per-feed intervals internally)

### 5.4 `apps/extension` — Browser Extension

Browser extension for saving content to Focus Reader. Communicates with the REST API.

```
apps/extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts   # Background service worker
│   ├── content/
│   │   └── content-script.ts   # Page content extraction
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.tsx           # Save UI with tag picker
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   └── options.tsx         # API URL + key configuration
│   └── lib/
│       └── api-client.ts       # REST API client
├── manifest.json               # WebExtension manifest v3
├── tsconfig.json
└── package.json
```

**Dependencies:**
- `@focus-reader/shared` (`workspace:*`) — types and constants only

> **Note:** The extension does not depend on `@focus-reader/db`, `@focus-reader/parser`, or `@focus-reader/api`. It communicates with the server exclusively via the REST API. It only imports types and constants from `@focus-reader/shared`.

---

## 6. Dependency Graph

```
@focus-reader/shared          ← foundation (no internal deps)
       │
       ├── @focus-reader/db           ← depends on shared
       │
       ├── @focus-reader/parser       ← depends on shared
       │
       └── @focus-reader/api          ← depends on shared, db, parser
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
 apps/web   apps/email-worker  apps/rss-worker     apps/extension
                                                     │
                                              (shared types only)
```

All `workspace:*` dependencies flow downward. There are no circular dependencies.

---

## 7. Shared Cloudflare Bindings

All worker-based apps (`apps/web`, `apps/email-worker`, `apps/rss-worker`) bind to the **same** D1 database and R2 bucket. Each app's `wrangler.toml` declares these bindings independently, pointing to the same Cloudflare resource IDs.

| Binding Name    | Type | Resource              | Used By                                             |
|-----------------|------|-----------------------|-----------------------------------------------------|
| `FOCUS_DB`      | D1   | Focus Reader database | web, email-worker, rss-worker                       |
| `FOCUS_STORAGE` | R2   | Binary object storage | web (PDF upload), email-worker (future attachments) |

> **Naming convention:** All binding names use the `FOCUS_` prefix to avoid collisions with Cloudflare's built-in environment variables.

---

## 8. Scripts and Task Pipeline

### 8.1 Common Scripts (per workspace)

Each workspace defines a consistent set of scripts in its `package.json`:

| Script      | Description                          |
|-------------|--------------------------------------|
| `build`     | Compile TypeScript / build the app   |
| `dev`       | Start in development mode            |
| `test`      | Run tests (vitest)                   |
| `lint`      | Run ESLint                           |
| `typecheck` | Run `tsc --noEmit`                   |
| `clean`     | Remove `dist/`, `.next/`, etc.       |

### 8.2 Root-Level Commands

All commands are run from the repository root via Turborepo:

```bash
pnpm build              # Build all packages and apps (in dependency order)
pnpm dev                # Start all apps in dev mode (parallel)
pnpm test               # Run all tests
pnpm lint               # Lint all workspaces
pnpm typecheck          # Type-check all workspaces
pnpm db:migrate         # Run D1 migrations
pnpm --filter apps/web dev        # Dev only the web app (+ its package deps)
pnpm --filter @focus-reader/db test   # Test only the db package
```

### 8.3 Shared Local Persistence

To ensure all workspaces share the same local D1 and R2 state during development, the root `dev` command must enforce a shared persistence directory. This prevents the `email-worker` from writing to one SQLite file while `apps/web` reads from another.

```bash
# Example root command implementation
turbo run dev -- --persist-to ../../.wrangler/state
```

---

## 9. Testing Strategy

| Layer               | Framework | Scope                                                    |
|---------------------|-----------|----------------------------------------------------------|
| `packages/shared`   | Vitest    | Unit tests for utilities (URL normalization, slug, time) |
| `packages/db`       | Vitest    | Query tests against D1 miniflare bindings                |
| `packages/parser`   | Vitest    | Unit tests with fixture emails, articles, feeds          |
| `packages/api`      | Vitest    | Integration tests with mocked D1                         |
| `apps/web`          | Vitest    | Component tests, API route tests                         |
| `apps/email-worker` | Vitest    | Integration tests with miniflare email event simulation  |
| `apps/rss-worker`   | Vitest    | Integration tests with miniflare scheduled event sim     |
| `apps/extension`    | Vitest    | Unit tests for content extraction and API client         |

All workspaces use **Vitest** for consistency. Cloudflare-specific tests use `@cloudflare/vitest-pool-workers` (miniflare) for local D1/R2/Worker simulation.

---

## 10. CI/CD Pipeline

A single GitHub Actions workflow handles all workspaces:

1. **Install:** `pnpm install --frozen-lockfile`
2. **Typecheck:** `pnpm typecheck` (all workspaces, parallel via Turbo)
3. **Lint:** `pnpm lint` (all workspaces, parallel via Turbo)
4. **Test:** `pnpm test` (all workspaces, dependency-ordered via Turbo)
5. **Build:** `pnpm build` (all workspaces, dependency-ordered via Turbo)
6. **Deploy** (on `main` branch only):
   - `apps/web` → `wrangler pages deploy`
   - `apps/email-worker` → `wrangler deploy`
   - `apps/rss-worker` → `wrangler deploy`
   - D1 migrations → `wrangler d1 migrations apply` (before app deployments)

Turborepo remote caching is enabled in CI to skip unchanged workspaces.

---

## 12. Secret Management

Focus Reader relies on environment variables for configuration and secrets (e.g., `OWNER_EMAIL`). 

- **Local Development:** Each app workspace (`apps/web`, `apps/email-worker`, `apps/rss-worker`) uses a `.dev.vars` file for local secrets. These files are excluded from version control.
- **Production:** Secrets are provisioned using `wrangler secret put` for each deployable unit.
- **Synchronization:** A root-level `scripts/sync-secrets.sh` utility is used to propagate shared non-sensitive configuration variables across the multiple `wrangler.toml` files and local environment templates, ensuring consistency across the stack.

---

## 13. Implementation Details

### 13.1 Local State Orchestration
When running the stack locally via `turbo run dev`, Turborepo orchestrates multiple `wrangler dev` instances. By passing the `--persist-to` flag relative to each workspace, we direct all emulated services (D1, R2) to the same directory in the project root. This allows for a seamless "Ingest in Worker -> View in Web" local feedback loop.

### 13.2 Ownership Bootstrap
The system identifies the administrator by comparing the `email` claim in the Cloudflare Access JWT against the `OWNER_EMAIL` environment variable. This variable must be configured identically across all ingestors and the web API to ensure consistent authorization logic.

---

## 14. Relationship to Other Specifications

- **[Focus Reader PRD](./focus-reader-prd.md):** Defines the product requirements, data model, and feature specifications that this repo structure implements.
- **[Email Newsletter PRD](./email-newsletter-prd.md):** Detailed specification for the email ingestion subsystem, implemented primarily in `packages/parser/src/email/` and `apps/email-worker/`.
