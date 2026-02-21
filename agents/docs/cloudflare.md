# Cloudflare & Local Development

For production rollout steps of the multi-user login-first onboarding release, see `agents/docs/multi-user-onboarding-rollout.md`.

## Bindings

| Binding         | Type        | Used By                            |
|-----------------|-------------|------------------------------------|
| `FOCUS_DB`      | D1 Database | email-worker, web, db (migrations) |
| `FOCUS_STORAGE` | R2 Bucket   | email-worker, web                  |

Environment variables:
- `EMAIL_DOMAIN` — Catch-all email subdomain (e.g., `read.yourdomain.com`)
- `COLLAPSE_PLUS_ALIAS` — `"true"` or `"false"`, controls plus-alias collapsing
- `OWNER_EMAIL` — Owner email for auto-creating the sole user in single-user mode
- `AUTH_MODE` — `single-user` (default, self-hosted) or `multi-user` (SaaS with Better Auth magic-link sessions)
- `AUTH_SECRET` — Secret for Better Auth session signing (required in `multi-user`)
- `BETTER_AUTH_URL` — Base URL for Better Auth endpoints (required in `multi-user`)
- `RESEND_API_KEY` — Resend API key for magic-link emails (required in `multi-user`; omit for console logging in local dev)
- `RESEND_FROM_EMAIL` — Sender address for magic-link emails (required in `multi-user`)
- `CF_ACCESS_TEAM_DOMAIN` — Optional CF Access team domain (single-user perimeter auth)
- `CF_ACCESS_AUD` — Optional CF Access audience tag (single-user perimeter auth)

## Starting Dev Servers

```bash
# Terminal 1: Web app (Next.js on port 3000)
pnpm --filter focus-reader-web dev

# Terminal 2: Email worker (optional, for testing email ingestion)
pnpm --filter focus-reader-email-worker dev
```

## Shared Local D1/R2 State

The web app and email worker share Cloudflare D1 and R2 bindings during local development:

- **Web app:** `apps/web/next.config.ts` calls `initOpenNextCloudflareForDev()` with `persist: { path: "../../.wrangler/state/v3" }`. The `apps/web/wrangler.toml` configures D1/R2 bindings and `[miniflare]` persist paths pointing to the same shared location.
- **Email worker:** `apps/email-worker/package.json` dev script uses `--persist-to ../../.wrangler/state`.

This means documents ingested by the email worker appear immediately in the web app's UI.

## Applying Migrations

```bash
# Apply migrations to the shared local D1
pnpm --filter @focus-reader/db wrangler d1 migrations apply focus-reader-db --local
```

Or use the `wrangler.toml` in `apps/web/` or `apps/email-worker/` which both reference `migrations_dir = "../../packages/db/migrations"`.

## Web App Bindings

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

## D1 Constraints

- **Foreign keys are NOT enforced** in production. Implement cascading deletes at the application level.

## Multi-Tenancy

All primary entity tables have a `user_id TEXT NOT NULL` column. The migration `0004_multi_tenancy.sql` creates the `user` table and adds `user_id` to existing tables. The migration `0005_auth_hybrid.sql` adds `email_verified` to the `user` table and creates the `session` and `verification` tables for Better Auth.

When applying migrations locally:
```bash
pnpm --filter @focus-reader/db wrangler d1 migrations apply focus-reader-db --local
```

The `user` table is required for all operations — even in single-user mode, a user row is auto-created on first request via `getOrCreateSingleUser()`.
