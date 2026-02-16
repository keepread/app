# Agents Guide

Focus Reader is a self-hosted read-it-later app deployed on Cloudflare (Workers, D1, R2, Pages), ingesting content from email newsletters, web articles, RSS feeds, and bookmarks into a unified reading interface. Phases 0–3 are complete.

## Build & Test

```bash
pnpm install                              # Install all dependencies
pnpm build                                # Build all packages (turbo)
pnpm typecheck                            # Type-check all packages
pnpm test                                 # Run all tests (requires build first)
pnpm --filter @focus-reader/<pkg> test    # Single package
```

**Always verify with `pnpm build && pnpm typecheck && pnpm test` before committing.**

## Repository Structure

```
focus-reader/
├── packages/
│   ├── shared/          # Types, constants, utilities (no deps)
│   ├── db/              # D1 migrations, typed query helpers
│   ├── parser/          # Email/article/RSS/PDF parsing, sanitization, export
│   └── api/             # REST API business logic
├── apps/
│   ├── web/             # Next.js 15 frontend on Cloudflare Pages
│   ├── email-worker/    # Cloudflare Email Worker
│   ├── rss-worker/      # Cloudflare Worker (scheduled RSS polling)
│   └── extension/       # Browser extension (WXT + React)
└── agents/
    ├── spec/            # Product requirement documents
    ├── plans/           # Phase implementation plans (all complete)
    └── docs/            # Detailed development guides
```

## Quick Reference

- **Entity types:** `packages/shared/src/types.ts` (D1 conventions: `number` for bools, `string` for timestamps/UUIDs)
- **Query helpers:** `packages/db/src/queries/` — every function takes `db: D1Database` as first param
- **API pattern:** `apps/web/src/app/api/` routes are thin wrappers around `@focus-reader/api` business logic
- **Sanitization:** `packages/parser/src/sanitize.ts` — manual linkedom walker (NOT DOMPurify)

## Key Constraints

- **vitest** pinned to `~3.2.0` — `@cloudflare/vitest-pool-workers` does NOT support vitest 4.x
- **No DOMPurify** — incompatible with Workers. Use the manual linkedom sanitizer in `packages/parser/src/sanitize.ts`
- **D1 foreign keys** NOT enforced in production — implement cascading deletes at the application level
- **Always `pnpm build` before `pnpm test`** — tests depend on `^build` in turbo.json
- **Import paths** use `.js` extensions (ESM convention)

## Detailed Guides

Read these when working on specific areas:

- [TypeScript & Bundling Conventions](agents/docs/typescript-conventions.md) — module system, tsup, entity types, query helpers, sanitization, markdown conversion
- [Testing Patterns & Gotchas](agents/docs/testing.md) — test frameworks, version constraints, 6 workerd-specific gotchas
- [Web App Architecture](agents/docs/web-app.md) — layout patterns, API routes, auth, data fetching, features
- [Email Worker Pipeline](agents/docs/email-worker.md) — 17-step ingestion pipeline, retry logic, postal-mime pitfalls
- [Cloudflare & Local Development](agents/docs/cloudflare.md) — bindings, env vars, shared D1/R2 state, migrations

## Specifications

Read the relevant spec before implementing a feature:

- [Product Requirements](agents/spec/focus-reader-prd.md) — source of truth for entity schemas, features, phasing
- [Email Newsletter Pipeline](agents/spec/email-newsletter-prd.md) — email ingestion details, subscription model
- [UI Specification](agents/spec/focus-reader-ui-spec.md) — layout, components, keyboard shortcuts
- [Browser Extension](agents/spec/browser-extension-spec.md) — popup, side panel, content script, API integration
- [Repo Structure](agents/spec/repo-structure.md) — monorepo rationale and workspace conventions

## Implementation Plans

All phases complete (0–3):

- [Phase 0](agents/plans/phase-0-plan.md) — Email PoC (steps 1–5)
- [Phase 1](agents/plans/phase-1-plan.md) — MVP Reader (steps 6–9)
- [Phase 2](agents/plans/phase-2-plan.md) — RSS, Search, Extension, Auth (steps 10–20)
- [Phase 3](agents/plans/phase-3-plan.md) — Highlights, Collections, Preferences, Export (steps 21–28)
