# Cloudflare & Local Development

This guide covers the Cloudflare bindings and local runtime model currently used by Focus Reader.

## Deployable Surfaces

- `apps/web` (Next.js 15 on OpenNext Cloudflare worker)
- `apps/email-worker` (Email routing ingestion worker)
- `apps/rss-worker` (scheduled polling + queue consumer worker)

## Core Bindings

| Binding | Type | Used By |
|---|---|---|
| `FOCUS_DB` | D1 Database | web, email-worker, rss-worker, db migrations |
| `FOCUS_STORAGE` | R2 Bucket | web, email-worker, rss-worker |
| `EXTRACTION_QUEUE` | Queue producer/consumer | web producer, rss-worker producer+consumer |

## Auth and App Env Vars

Common runtime variables:

- `AUTH_MODE`: `single-user` or `multi-user`
- `OWNER_EMAIL`: owner account seed for single-user auto-auth
- `EMAIL_DOMAIN`: inbound email domain for subscription routing
- `COLLAPSE_PLUS_ALIAS`: alias normalization toggle

Single-user perimeter auth (optional):

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`

Multi-user session auth (required for production multi-user):

- `AUTH_SECRET`
- `BETTER_AUTH_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Queue/browser-rendering variables (rss-worker):

- `BROWSER_RENDERING_ENABLED`
- `BROWSER_RENDERING_ACCOUNT_ID`
- `BROWSER_RENDERING_API_TOKEN`
- `BROWSER_RENDERING_TIMEOUT_MS`

## Local Development Runtime

Web and email-worker can share local persisted state for D1/R2:

- Web dev uses `initOpenNextCloudflareForDev()` and local wrangler bindings
- Email worker dev command persists under repo-level `.wrangler/state`

This lets ingested emails appear in the web UI immediately when both dev servers run.

## Local Setup Sequence

```bash
pnpm install
pnpm build
pnpm db:migrate
pnpm --filter focus-reader-web dev
# optional second terminal
pnpm --filter focus-reader-email-worker dev
```

## Migrations

Apply locally:

```bash
pnpm --filter @focus-reader/db run migrate
```

Apply remotely:

```bash
pnpm --filter @focus-reader/db exec -- \
  wrangler d1 migrations apply FOCUS_DB --remote
```

## Worker Responsibilities

- `email-worker`: parse + sanitize + dedup + persist email documents
- `rss-worker` scheduled: poll due feeds and ingest items
- `rss-worker` queue: process enrichment and image cache jobs

## Operational Constraints

- D1 foreign key enforcement should not be assumed in production
- Use app-level cascading deletes in API/query layer
- Build before test (`pnpm build` then test/typecheck), especially when worker tests depend on built package outputs
