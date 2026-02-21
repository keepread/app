# Multi-User Login-First + Onboarding Rollout Runbook

## Purpose

This runbook covers safe rollout of the login-first multi-user auth flow and first-time onboarding slug step.

Behavior introduced:

1. In `AUTH_MODE=multi-user`, unauthenticated users are redirected to `/login` before reader UI loads.
2. New users are redirected to `/onboarding` after magic-link verification and must set a slug.
3. Existing users are grandfathered as already onboarded.

## Change Summary

1. DB migration: `packages/db/migrations/0008_user_onboarding.sql`.
2. New user column: `user.onboarding_completed_at`.
3. Auth API updates: `GET /api/auth/me` now returns `needsOnboarding` and `user.onboarding_completed_at`; `PATCH /api/auth/me` updates slug and marks onboarding complete.
4. Multi-user server-side route gates: unauthenticated -> `/login`; authenticated + not onboarded -> `/onboarding`; authenticated + onboarded -> reader routes.

## Deployment Safety Notes

1. The migration is additive and safe to apply ahead of app deploy.
2. Apply DB migration before deploying web code in environments running `AUTH_MODE=multi-user`.
3. `0008_user_onboarding.sql` backfills existing users by setting `onboarding_completed_at` to current UTC time, so existing users are not forced through onboarding.

## Required Configuration

No new environment variables are introduced by this change.

For `AUTH_MODE=multi-user`, verify these are already present:

1. `AUTH_MODE=multi-user` (web `wrangler.toml` vars)
2. `BETTER_AUTH_URL` (web `wrangler.toml` vars)
3. `RESEND_FROM_EMAIL` (web `wrangler.toml` vars)
4. `AUTH_SECRET` (web secret)
5. `RESEND_API_KEY` (web secret)

`AUTH_MODE=single-user` behavior is unchanged.

## Rollout Order

Use the same order in staging and production.

1. Preflight checks
2. Apply DB migration
3. Deploy web app
4. Run smoke tests
5. Monitor

## Step-by-Step Commands

Run from repository root unless noted.

### 1) Preflight

```bash
pnpm build && pnpm typecheck && pnpm test
```

Optional: capture a DB backup before migration.

```bash
pnpm --filter @focus-reader/db exec -- wrangler d1 export FOCUS_DB --remote --output ./tmp/focus-db-pre-0008.sql --config packages/db/wrangler.toml
```

### 2) Apply Migration (must happen before web deploy in multi-user environments)

```bash
pnpm --filter @focus-reader/db exec -- wrangler d1 migrations apply FOCUS_DB --remote --config packages/db/wrangler.toml
```

Verify column exists:

```bash
pnpm --filter @focus-reader/db exec -- wrangler d1 execute FOCUS_DB --remote --command "PRAGMA table_info(user);" --config packages/db/wrangler.toml
```

Expected: `onboarding_completed_at` appears in output.

### 3) Deploy Web App

```bash
cd apps/web
pnpm exec opennextjs-cloudflare build
pnpm exec wrangler deploy
cd ../..
```

Deploy email/rss workers only if your release includes changes for those apps.

### 4) Smoke Tests (staging first, then production)

Test these scenarios in `AUTH_MODE=multi-user`:

1. Unauthenticated visit to `/inbox` redirects immediately to `/login` (no reader shell flash).
2. New user magic-link login lands on `/onboarding`.
3. Onboarding slug submit succeeds and lands on `/inbox`.
4. Existing user login lands directly on `/inbox`.
5. Slug conflict shows a user-facing error and does not complete onboarding.

Also verify `AUTH_MODE=single-user` still auto-auths and reaches `/inbox`.

## Monitoring Checklist (first 24h)

1. `GET /api/auth/me` error rate
2. `PATCH /api/auth/me` error rate by code (`INVALID_SLUG`, `SLUG_TAKEN`, `UPDATE_ERROR`)
3. Login success vs onboarding completion funnel
4. Any increase in redirect loops (`/login` <-> `/onboarding` <-> `/inbox`)

## Backout Plan

1. If migration succeeds but web behavior is problematic: re-deploy previous web version and keep migration in place (additive, non-destructive).
2. If onboarding blocks users in production: temporarily relax server gate to allow authenticated users into `/inbox` while keeping onboarding update endpoint available.
3. If severe auth routing regression occurs: revert route-gating changes in `apps/web/src/app/(reader)/layout.tsx` and auth page guards, then redeploy web immediately.

## Handoff Notes

1. This release is effectively DB-first, then app.
2. Existing users are intentionally grandfathered at migration time.
3. The highest risk is redirect-loop regression, not data corruption.
