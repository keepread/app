# Focus Reader: Cloudflare Installation Wiki (Self-Hosted)

This guide is for someone deploying Focus Reader to their own Cloudflare account.

## 1. What You Are Deploying

Focus Reader has three deployable services:

1. `focus-reader-web` (Next.js app + API routes on Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare))
2. `focus-reader-email-worker` (Cloudflare Email Worker for newsletter ingestion)
3. `focus-reader-rss-worker` (scheduled Cloudflare Worker for feed polling, runs every 12 hours)

Shared data services:

1. `FOCUS_DB` (Cloudflare D1)
2. `FOCUS_STORAGE` (Cloudflare R2 for content/attachments)
3. `NEXT_INC_CACHE_R2_BUCKET` (Cloudflare R2 for Next/OpenNext cache)

## 2. Prerequisites

1. Cloudflare account with Workers enabled.
2. Cloudflare D1 enabled.
3. Cloudflare R2 enabled.
4. Cloudflare Email Routing enabled (if using newsletter ingestion).
5. Cloudflare Access / Zero Trust enabled (recommended for auth).
6. Node.js 20+.
7. `pnpm` 10+.
8. `wrangler` CLI authenticated to your account (`wrangler login`).

## 3. Clone and Install

```bash
git clone https://github.com/georgeck/focus-reader
cd focus-reader
pnpm install
```

## 4. Create Cloudflare Resources

Create these resources in your Cloudflare account:

1. D1 database:
```bash
wrangler d1 create focus-reader-db
```

2. R2 buckets:
```bash
wrangler r2 bucket create focus-reader-storage
wrangler r2 bucket create focus-reader-cache
```

Record these values — you will need them in the next step:

1. Cloudflare `account_id` (from your Cloudflare dashboard)
2. D1 `database_id` (printed by `wrangler d1 create`)
3. R2 bucket names (as created above)

## 5. Update Wrangler Config Files

Update these files with your own Cloudflare values:

| File                              | Field                     | What to change                                |
|-----------------------------------|---------------------------|-----------------------------------------------|
| `apps/web/wrangler.toml`          | `account_id`              | Your Cloudflare account ID                    |
| `apps/web/wrangler.toml`          | `routes[0].pattern`       | Your domain (e.g. `reader.yourdomain.com`)    |
| `apps/web/wrangler.toml`          | `EMAIL_DOMAIN` var        | Your email subdomain (e.g. `yourdomain.com`)  |
| `apps/email-worker/wrangler.toml` | `EMAIL_DOMAIN` var        | Same as above                                 |
| `apps/email-worker/wrangler.toml` | `COLLAPSE_PLUS_ALIAS` var | `true` or `false`                             |
| All 4 wrangler.toml files         | `database_id`             | Your D1 database ID                           |
| All 4 wrangler.toml files         | `database_name`           | Only if you changed it from `focus-reader-db` |
| `apps/web/wrangler.toml`          | R2 `bucket_name` values   | Only if you changed bucket names              |
| `apps/email-worker/wrangler.toml` | R2 `bucket_name`          | Only if you changed the storage bucket name   |

The 4 wrangler.toml files are:
1. `apps/web/wrangler.toml`
2. `apps/email-worker/wrangler.toml`
3. `apps/rss-worker/wrangler.toml`
4. `packages/db/wrangler.toml`

Note: `account_id` is only required in `apps/web/wrangler.toml`. The other workers infer it from your `wrangler login` session.

## 6. Configure Environment Variables and Secrets

### 6.1 Web app (`apps/web`)

`EMAIL_DOMAIN` is set as a `[vars]` entry in `wrangler.toml` (updated in step 5).

Required secrets (set via Wrangler):

```bash
cd apps/web
wrangler secret put OWNER_EMAIL
wrangler secret put CF_ACCESS_TEAM_DOMAIN
wrangler secret put CF_ACCESS_AUD
```

Notes:

1. `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` enable Cloudflare Access JWT verification.
2. `OWNER_EMAIL` locks browser access to a single identity.
3. If `CF_ACCESS_*` are not set, API routes allow requests without CF Access (dev/single-user mode). Do not do this on a public domain.

### 6.2 Email worker (`apps/email-worker`)

`EMAIL_DOMAIN` and `COLLAPSE_PLUS_ALIAS` are configured in `wrangler.toml` as vars (updated in step 5). No secrets are required for the email worker.

### 6.3 Local dev var helper (optional)

For local development, copy the example file or use the sync script:

```bash
# Option 1: Copy the example and edit
cp .dev.vars.example apps/web/.dev.vars
cp .dev.vars.example apps/email-worker/.dev.vars
# Edit both files with your values

# Option 2: Use the sync script
EMAIL_DOMAIN=read.yourdomain.com COLLAPSE_PLUS_ALIAS=false OWNER_EMAIL=you@example.com ./scripts/sync-secrets.sh
```

## 7. Set Up Cloudflare Access (Recommended)

Create a Cloudflare Access application for your web domain:

1. Add your app domain (example: `reader.yourdomain.com`)
2. Add an allow policy for your identity/email
3. Copy the Access Audience (AUD) value
4. Set `CF_ACCESS_TEAM_DOMAIN`.
5. Set `CF_ACCESS_AUD`.
6. Set `OWNER_EMAIL` (recommended single-user lock).

## 8. Set Up Email Routing (Optional but Recommended)

If using newsletter ingestion:

1. In Cloudflare Email Routing, create route `*@<EMAIL_DOMAIN>`
2. Target the deployed `focus-reader-email-worker`
3. Verify the domain/subdomain in Cloudflare Email Routing

Example:

1. `EMAIL_DOMAIN=read.yourdomain.com`
2. Route `*@read.yourdomain.com` -> email worker

## 9. Deploy

From repo root:

### 9.1 One-command deployment

```bash
./scripts/deploy.sh
```

Targets:

```bash
./scripts/deploy.sh web
./scripts/deploy.sh email
./scripts/deploy.sh rss
```

### 9.2 What deploy script does

1. `pnpm build` — builds all packages
2. `pnpm typecheck` — verifies TypeScript types
3. Apply remote D1 migrations via `packages/db/wrangler.toml`
4. Deploy web worker ([OpenNext](https://opennext.js.org/cloudflare) build + Wrangler deploy)
5. Deploy email worker
6. Deploy RSS worker

Note: The deploy script does not run tests. Run `pnpm test` manually before deploying if desired.

## 10. Post-Deploy Verification Checklist

1. Open your web URL and confirm UI loads.
2. Open browser devtools network and verify `/api/settings` returns expected values.
3. In Settings -> API Keys, create a key.
4. Save a URL through the extension and confirm it appears in Inbox.
5. Add a test RSS feed and verify ingest after cron/manual trigger.
6. Send a newsletter to `topic@<EMAIL_DOMAIN>` and confirm ingest in app.

## 11. Browser Extension Setup (Optional)

1. Build extension:
```bash
pnpm --filter focus-reader-extension build
```

2. Load unpacked extension from:
`apps/extension/.output/chrome-mv3`

3. In extension options, set API URL to your web domain (example `https://reader.yourdomain.com`).
4. In extension options, set API key from Focus Reader Settings.

5. If using Chrome site access mode `When you click the extension`, grant site access when prompted for pages you save from.
6. If using Chrome site access mode `When you click the extension`, grant API host access when prompted from extension options/actions.

## 12. Local Development

### 12.1 Set up local environment

```bash
# Set up local .dev.vars files (see section 6.3)
cp .dev.vars.example apps/web/.dev.vars
cp .dev.vars.example apps/email-worker/.dev.vars

# Apply D1 migrations to local database
pnpm db:migrate
```

The `pnpm db:migrate` step is required — without it the local D1 database will have no tables and API routes will return 500 errors.

### 12.2 Start dev servers

```bash
# Start the web app (in one terminal)
pnpm --filter focus-reader-web dev

# Start the email worker (in another terminal, if needed)
pnpm --filter focus-reader-email-worker dev
```

Local dev uses `.wrangler/state/v3` for D1 and R2 persistence. The `initOpenNextCloudflareForDev` helper in `next.config.ts` provides Cloudflare bindings in the Next.js dev server.

## 13. Upgrade Procedure

When pulling new versions:

```bash
git pull
pnpm install
pnpm build
pnpm typecheck
pnpm test
./scripts/deploy.sh
```

Always apply migrations before traffic expects new schema (the deploy script does this automatically).

## 14. Common Issues and Fixes

### Issue: API routes return 500 and bindings are undefined

Cause:

1. Wrangler bindings not configured correctly in `apps/web/wrangler.toml`

Fix:

1. Verify D1 and R2 bindings and IDs in wrangler config
2. Redeploy web

### Issue: `401 Authentication required` on API routes

Cause:

1. Cloudflare Access vars set but cookie/API key missing or invalid

Fix:

1. Confirm CF Access app is active on your domain
2. Confirm `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` match the Access app
3. Use a valid API key (`Authorization: Bearer <key>`) for non-browser clients

### Issue: Search or delete returns 500 with `no such table: document_fts`

Cause:

1. D1 migrations not applied (FTS5 search table missing)

Fix:

1. For local dev: `pnpm db:migrate`
2. For production: `npx wrangler d1 migrations apply FOCUS_DB --remote --config packages/db/wrangler.toml`

### Issue: Email messages are not ingested

Cause:

1. Email Routing route missing/misconfigured
2. `EMAIL_DOMAIN` mismatch with route

Fix:

1. Verify route `*@<EMAIL_DOMAIN>` targets email worker
2. Verify `EMAIL_DOMAIN` in worker vars

### Issue: RSS polling does not run

Cause:

1. Cron trigger not configured/deployed

Fix:

1. Verify `apps/rss-worker/wrangler.toml` has `[triggers]` with `crons` entry
2. Redeploy RSS worker and check worker logs
3. Default schedule is `0 */12 * * *` (every 12 hours) — adjust in wrangler.toml if needed

### Issue: Extension CORS/permission errors in on-click mode

Cause:

1. API host permission not granted in Chrome extension permissions

Fix:

1. Open extension options
2. Re-save API URL and accept permission prompt

## 15. Security Recommendations

1. Always front the web app with Cloudflare Access in production.
2. Set `OWNER_EMAIL` to restrict browser access to your identity.
3. Use API keys only for automation/extension.
4. Rotate API keys periodically.
5. Keep your wrangler secrets out of git.

## 16. Quick Reference Commands

```bash
# Full deploy
./scripts/deploy.sh

# Deploy only web/email/rss
./scripts/deploy.sh web
./scripts/deploy.sh email
./scripts/deploy.sh rss

# Apply remote DB migrations manually
npx wrangler d1 migrations apply FOCUS_DB --remote --config packages/db/wrangler.toml

# Apply local DB migrations
pnpm db:migrate

# Local dev (web + email worker in separate terminals)
pnpm --filter focus-reader-web dev
pnpm --filter focus-reader-email-worker dev
```
