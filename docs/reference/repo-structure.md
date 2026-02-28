# Repository Structure (Reference)

**Status:** Live  
**Last validated:** 2026-02-28

## Overview

Focus Reader is a PNPM monorepo orchestrated with Turborepo.

## Directory Map

```text
focus-reader/
├── apps/
│   ├── web/            # Next.js 15 app (Cloudflare via OpenNext)
│   ├── email-worker/   # Email ingestion worker
│   ├── rss-worker/     # Scheduled RSS poller + queue consumer
│   └── extension/      # Browser extension (WXT + React)
├── packages/
│   ├── shared/         # Shared types/constants/utils
│   ├── db/             # D1 schema, migrations, query helpers
│   ├── parser/         # Email/article/rss/pdf parsing + sanitize
│   └── api/            # Business logic layer
├── scripts/            # Deployment/local utility scripts
├── docs/               # Live + archived documentation
├── AGENTS.md           # Agent operating guidance
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Workspace Boundaries

- `apps/*` contain runtime/deploy units
- `packages/*` contain reusable logic shared by apps
- App route handlers should stay thin and delegate business logic to `@focus-reader/api`
- Query access should flow through `@focus-reader/db` and `UserScopedDb`

## Build and Test Conventions

- Build all: `pnpm build`
- Typecheck all: `pnpm typecheck`
- Test all: `pnpm test`
- Run build before test because test tasks depend on built outputs

## Where to Edit

- DB schema/query changes: `packages/db`
- Parsing/sanitization/extraction changes: `packages/parser`
- Business logic changes: `packages/api`
- API surface and UI behavior: `apps/web`
- Email pipeline behavior: `apps/email-worker`
- RSS polling/enrichment queue: `apps/rss-worker`
- Extension behavior: `apps/extension`

## Related Docs

- `docs/architecture/overview.md`
- `docs/architecture/web-app.md`
- `docs/architecture/email-ingestion.md`
- `docs/architecture/rss-ingestion-and-queue.md`
- `docs/development/typescript-conventions.md`
