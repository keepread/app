# Multi-User Login-First + First-Time Onboarding Implementation Plan

## Document Status
- Author: Codex
- Date: 2026-02-20
- Scope: Web auth UX + onboarding flow for `AUTH_MODE=multi-user`
- Delivery Type: Detailed handoff plan for implementation by another agent/engineer

## Summary
Implement a server-gated auth and onboarding flow for `AUTH_MODE=multi-user` so unauthenticated users are redirected to `/login` before reader UI renders (no shell/skeleton flash), and first-time users are redirected to `/onboarding` to set a slug before accessing reader routes.

Keep `AUTH_MODE=single-user` behavior unchanged.

Existing multi-user users are grandfathered as already onboarded at migration time.

## Product Decisions Locked
1. Onboarding is mandatory for new multi-user users.
2. Existing multi-user users are grandfathered and do not need to complete onboarding after rollout.
3. Slug is editable during onboarding, with auto-normalization + validation.
4. Magic-link redirect behavior:
- Returning users: `/inbox`
- New users: `/onboarding`

## Goals
1. In multi-user mode, unauthenticated users should see `/login` first, not reader shell.
2. In multi-user mode, new users must complete onboarding once.
3. Onboarding supports slug update with server-enforced uniqueness.
4. No behavior regression for single-user mode.
5. Preserve existing API-key auth behavior in both modes.
6. Keep auth architecture extensible for future Better Auth login methods.

## Non-Goals
1. No invite system.
2. No billing/subscription constraints.
3. No 2FA/passkeys.
4. No major account settings redesign.
5. No deprecation/removal of magic-link.

## Current State (Ground Truth)
### Auth resolution
- `apps/web/src/lib/auth-middleware.ts` handles mode-scoped auth.
- In `multi-user`, Better Auth session (`fr_session`) is checked first, then API key fallback.
- In `single-user`, CF Access/API key/auto-auth behavior comes from `packages/api/src/auth.ts`.

### Redirect behavior causing flash
- Client-side redirect lives in `apps/web/src/lib/user-context.tsx`:
  - Fetches `/api/auth/me` with SWR
  - Redirects unauthenticated multi-user users to `/login` in `useEffect`
- Reader UI (`AppShell`) can render before this redirect settles.

### Routing structure
- Reader routes are wrapped by `apps/web/src/app/(reader)/layout.tsx` (currently client component).
- Root route `apps/web/src/app/page.tsx` redirects directly to `/inbox`.

### Login callbacks
- `apps/web/src/app/api/auth/login/route.ts` uses:
  - `callbackURL: "/inbox"`
  - `newUserCallbackURL: "/inbox"`
- `apps/web/src/app/api/auth/verify/route.ts` mirrors the same.

### Missing onboarding marker
- `user` table has no onboarding completion field yet.

## Target Behavior
### Multi-user mode
1. Unauthenticated user requests `/`, `/inbox`, or any reader route:
- Server redirects to `/login` before reader layout renders.

2. Authenticated user with incomplete onboarding:
- Server redirects to `/onboarding`.

3. Authenticated user with completed onboarding:
- Route resolves normally.

4. Login page behavior:
- Unauthenticated: shown.
- Authenticated + onboarded: redirect to `/inbox`.
- Authenticated + not onboarded: redirect to `/onboarding`.

5. Onboarding page behavior:
- Unauthenticated in multi-user: redirect to `/login`.
- Authenticated + already onboarded: redirect to `/inbox`.
- Authenticated + not onboarded: show slug form.

### Single-user mode
- Keep existing behavior; no forced login/onboarding.

## Data Model Changes
### Migration
Create `packages/db/migrations/0006_user_onboarding.sql`:

```sql
ALTER TABLE user ADD COLUMN onboarding_completed_at TEXT;

UPDATE user
SET onboarding_completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE onboarding_completed_at IS NULL;
```

### Rationale
- New users created after deployment have `onboarding_completed_at = NULL` and must onboard.
- Existing users are grandfathered automatically.

### Required follow-up updates
1. Add migration SQL constant in `packages/db/src/migration-sql.ts` (e.g. `USER_ONBOARDING_SQL`).
2. Include this migration constant in test migration composition.
3. Update shared `User` type in `packages/shared/src/types.ts` with:
- `onboarding_completed_at: string | null`

## API Contract Changes
### `GET /api/auth/me`
File: `apps/web/src/app/api/auth/me/route.ts`

Add fields:
- `needsOnboarding: boolean`
- `user.onboarding_completed_at`

Response example:

```json
{
  "authenticated": true,
  "authMode": "multi-user",
  "method": "session",
  "needsOnboarding": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "slug": "user",
    "name": null,
    "avatar_url": null,
    "onboarding_completed_at": null
  }
}
```

### `PATCH /api/auth/me`
File: `apps/web/src/app/api/auth/me/route.ts`

Purpose:
- Complete onboarding/update slug for current authenticated user.

Body:

```json
{ "slug": "new-slug" }
```

Behavior:
1. Multi-user only.
2. Resolve authenticated user via existing auth middleware.
3. Normalize slug.
4. Validate slug.
5. Enforce uniqueness.
6. Update current user slug.
7. Set `onboarding_completed_at` if null.

Error codes:
- `UNSUPPORTED_MODE` (400)
- `INVALID_SLUG` (400)
- `SLUG_TAKEN` (409)
- `UNAUTHORIZED` (401)
- `AUTH_ME_ERROR`/`UPDATE_ERROR` (500)

## Slug Rules (Strict)
### Client-side UX behavior
- As user types, show normalized value live.

### Server-side canonical behavior
1. Lowercase input.
2. Replace all non `[a-z0-9]` runs with `-`.
3. Collapse repeated hyphens.
4. Trim leading/trailing hyphens.
5. Validate length: `3 <= len <= 30`.
6. Validate charset post-normalization: `[a-z0-9-]`.
7. Reject empty result.

### Conflict behavior
- If slug already belongs to a different user, return `SLUG_TAKEN`.
- Do not silently append random suffixes.

## Backend Implementation Plan

### 1) DB query helpers
Create: `packages/db/src/queries/user-profile.ts`

Functions:
1. `getCurrentUserById(db: D1Database, userId: string): Promise<User | null>`
2. `getUserBySlugExcludingId(db: D1Database, slug: string, userId: string): Promise<User | null>`
3. `updateUserSlugAndOnboarding(db: D1Database, userId: string, slug: string, completedAt: string): Promise<void>`

Notes:
- This file can use raw `D1Database` since user row is global and already keyed by `id`.
- Ensure update includes `updated_at` mutation.

Export via `packages/db/src/index.ts`.

### 2) API layer function
Create: `packages/api/src/user-profile.ts`

Functions:
1. `normalizeSlugInput(input: string): string`
2. `validateSlug(slug: string): void` (throw typed error)
3. `completeUserOnboarding(db: D1Database, userId: string, slugInput: string): Promise<User>`

Flow in `completeUserOnboarding`:
1. Normalize.
2. Validate.
3. Check collision excluding current user.
4. Read current user (ensure exists and active as needed).
5. Update slug and set `onboarding_completed_at` if null.
6. Return updated user.

Export via `packages/api/src/index.ts`.

### 3) Auth me route
Update: `apps/web/src/app/api/auth/me/route.ts`

GET updates:
1. Add `needsOnboarding` derived from:
- `authMode === "multi-user" && user.onboarding_completed_at == null`

PATCH add:
1. Resolve auth with existing middleware.
2. Enforce `AUTH_MODE === "multi-user"`.
3. Parse JSON body slug.
4. Call API-layer onboarding function.
5. Return updated auth payload.

### 4) Magic-link callback changes
Update both files:
- `apps/web/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/auth/verify/route.ts`

Changes:
- `newUserCallbackURL` from `/inbox` -> `/onboarding`
- keep `callbackURL` for returning users as `/inbox`

## Web Routing and Layout Refactor

### 1) Introduce server-side gate helper
Create: `apps/web/src/lib/server-auth.ts`

Responsibilities:
1. Inspect env (`AUTH_MODE`).
2. Resolve current user session in server context (via Better Auth where applicable).
3. Fetch current user row (including onboarding field).
4. Return compact state object:

```ts
{
  authMode: "single-user" | "multi-user";
  authenticated: boolean;
  userId?: string;
  needsOnboarding?: boolean;
}
```

### 2) Convert reader layout to server gate + client shell split
Current file: `apps/web/src/app/(reader)/layout.tsx` (client)

Target:
1. Make `layout.tsx` a server component.
2. Gate logic:
- `multi-user` + unauthenticated => `redirect("/login")`
- `multi-user` + needs onboarding => `redirect("/onboarding")`
3. Move existing client-side provider/shell tree into new file:
- `apps/web/src/app/(reader)/reader-layout-client.tsx`

### 3) Root route update
Update `apps/web/src/app/page.tsx`:
1. Resolve server auth state.
2. Redirect according to mode/state:
- `multi-user` unauthenticated -> `/login`
- `multi-user` needs onboarding -> `/onboarding`
- otherwise -> `/inbox`

### 4) Auth routes guard behavior
Implement guard checks in:
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/onboarding/page.tsx` (new)

Behavior:
- Prevent logged-in onboarded users from seeing login/onboarding.
- Prevent unauthenticated access to onboarding.

### 5) UserProvider cleanup
File: `apps/web/src/lib/user-context.tsx`

Keep client redirects only as fallback safety (session expiry after hydration), but do not rely on it as primary auth gate.

## Onboarding UI Implementation
Create: `apps/web/src/app/(auth)/onboarding/page.tsx`

UI requirements:
1. Reuse existing auth layout frame (`(auth)/layout.tsx`).
2. Fields:
- `slug` (text)
- optional read-only preview of normalized slug
3. Submit:
- `PATCH /api/auth/me`
4. States:
- idle
- loading
- validation error (field-level)
- slug conflict (inline)
- success (redirect `/inbox`)
5. Accessibility:
- label/input association
- keyboard submit
- disabled button while loading

## Error Handling Plan
1. Distinguish client-validation vs server-validation errors.
2. Map server errors:
- `INVALID_SLUG` -> human-friendly validation message
- `SLUG_TAKEN` -> “Slug already in use”
3. Keep generic fallback for unknown failures.
4. Preserve generic login response in `/api/auth/login` to avoid account enumeration.

## Test Plan

### A) DB tests
1. Update schema drift test:
- `packages/db/src/__tests__/schema-drift.test.ts`
- add `onboarding_completed_at` in expected `user` columns.

2. Add new query tests for `user-profile` helpers:
- fetch by id
- slug uniqueness excluding same user
- update slug + onboarding timestamp

### B) API tests
1. Extend `apps/web/src/__tests__/api/auth-routes.test.ts`:
- verify `/api/auth/login` passes `newUserCallbackURL=/onboarding`
- verify `/api/auth/verify` redirects with `newUserCallbackURL=/onboarding`
- verify `GET /api/auth/me` includes onboarding fields
- add `PATCH /api/auth/me` tests:
  - success
  - invalid slug
  - slug taken
  - unsupported mode

### C) Route gating tests
Add tests (new file or extend route tests) for server redirects:
1. multi-user unauthenticated request to reader route -> `/login`
2. multi-user authenticated + not onboarded -> `/onboarding`
3. multi-user authenticated + onboarded -> reader route allowed
4. single-user unchanged path behavior

### D) Regression checks
1. Existing auth tests stay green.
2. No change in API-key auth semantics.

## Rollout Plan
1. Merge migration + code in same release.
2. Deploy to staging.
3. Verify scenarios manually:
- new multi-user login -> onboarding -> inbox
- existing multi-user user -> inbox directly
- unauthenticated direct `/inbox` -> `/login` without shell flash
- single-user local still auto-auths
4. Deploy production.
5. Monitor:
- `/api/auth/me` error rate
- onboarding completion success ratio
- slug conflict rate

## Backout Plan
1. If onboarding causes blocking failures:
- Temporarily bypass onboarding gate in server layout and allow authenticated users to `/inbox`.
2. If login redirect loops occur:
- Revert server layout gate changes and fall back to prior client redirect behavior.
3. Migration is additive; no destructive rollback needed.

## Acceptance Criteria
1. Multi-user unauthenticated users hit `/login` before reader UI renders.
2. Multi-user new users are forced through onboarding exactly once.
3. Existing multi-user users are not forced through onboarding post-deploy.
4. Slug onboarding supports auto-normalization and strict server validation/uniqueness.
5. Single-user behavior remains unchanged.
6. All tests pass.
7. Validation command succeeds:

```bash
pnpm build && pnpm typecheck && pnpm test
```

## Future Auth Method Expansion (Better Auth)
### Current feasibility
1. Email OTP: relatively low/medium effort (plugin support exists).
2. Email/password: medium effort (core support exists; may require account credential schema mapping/migration and reset UX).
3. Social login: medium/high effort (provider setup, callback policies, secret management, account-linking rules).

### Recommended sequence
1. Add email OTP as next incremental auth option.
2. Add email/password second.
3. Add selected social providers third.

## Implementation Checklist
1. Add migration + type updates.
2. Add DB/API user-profile helpers.
3. Extend auth me route (GET + PATCH).
4. Change magic-link new-user callback URLs.
5. Refactor reader layout to server gate + client shell split.
6. Add onboarding page and guards.
7. Add/update tests.
8. Run full validation command.
