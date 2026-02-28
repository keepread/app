# Auth and Tenancy

## Tenancy Model

Focus Reader uses row-level multi-tenancy in D1.

- Primary tables include `user_id`
- Query helpers use `UserScopedDb` (`{ db, userId }`)
- API/worker code scopes DB access via `scopeDb(db, userId)`
- Cross-tenant operations are isolated in admin query modules

## Auth Modes

Auth behavior is controlled by `AUTH_MODE`.

### Single-user

- CF Access JWT (if configured)
- API key bearer token
- Auto-auth fallback when CF Access is not configured

### Multi-user

- Better Auth session cookie (`fr_session`)
- API key bearer token
- Login/verify/onboarding flow in web app

## Request Auth Resolution

1. Web middleware/route layer resolves session where applicable
2. Shared API auth validates API key and single-user fallbacks
3. Route receives `userId` and creates `UserScopedDb`

## Key Files

- `apps/web/src/lib/auth-middleware.ts`
- `apps/web/src/lib/better-auth.ts`
- `apps/web/src/lib/server-auth.ts`
- `packages/api/src/auth.ts`
- `packages/db/src/scoped-db.ts`
