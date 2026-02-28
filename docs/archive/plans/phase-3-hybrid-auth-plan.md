# Phase 3 Plan: Mode-Scoped Hybrid Authentication

## Summary

This plan implements authentication for both deployment personas without overloading either one:

1. `AUTH_MODE=multi-user`: Better Auth sessions (magic-link) + API keys. No Cloudflare Access identity path.
2. `AUTH_MODE=single-user`: single-user auto-auth remains default; optional Cloudflare Access is supported as a perimeter gate.
3. API keys are supported in both modes for browser extension and automation use cases.

This is intentionally a "hybrid" architecture at the product level, but mode-scoped at runtime:

1. Multi-user SaaS gets application-native authentication.
2. Single-user self-hosted gets low-friction ops and optional edge perimeter auth.

## Goals

1. Add first-class magic-link authentication for multi-user mode.
2. Preserve zero-friction local development and self-hosted single-user UX.
3. Keep API key auth working in all modes.
4. Remove ambiguity in auth behavior by making it mode-dependent and explicit.
5. Keep row-level isolation guarantees unchanged (`UserScopedDb` everywhere).

## Non-Goals

1. Social login providers.
2. Password-based auth.
3. Passkeys/2FA.
4. Complex billing/subscription lifecycle and invite-admin UI.

## Final Auth Behavior Matrix

| Deployment mode                     | Browser auth                                             | Programmatic auth    | Notes                                                                                           |
|-------------------------------------|----------------------------------------------------------|----------------------|-------------------------------------------------------------------------------------------------|
| `multi-user`                        | App session cookie (`fr_session`) via magic link | API key bearer token | CF Access cookie is ignored for app identity in this mode. API keys power extension/automation. |
| `single-user` + no CF Access config | Auto-auth as sole owner user                             | API key bearer token | Localhost default. API keys still available for extension clients.                              |
| `single-user` + CF Access config    | CF Access JWT required for browser requests              | API key bearer token | Optional perimeter protection for self-hosted/VPN-like deployments. API keys remain valid.      |

## API Key Policy (All Modes)

1. API key authentication is always enabled in both `single-user` and `multi-user`.
2. API keys are the primary auth method for browser extension calls and other non-browser clients.
3. API keys remain user-scoped (`api_key.user_id`) and are validated through the existing hash path in `packages/api/src/auth.ts`.
4. Browser session auth and API key auth are parallel mechanisms, not mutually exclusive.

## Local and Private Deployment Behavior

### Local Development

1. Default local setup (`AUTH_MODE` unset or `single-user`): auto-auth as owner user.
2. Local multi-user testing (`AUTH_MODE=multi-user`): magic-link flow.
3. CF Access is not required for localhost.

### VPN-like / Private Network Deployments

1. Recommended: `AUTH_MODE=single-user`.
2. Optional: enable CF Access to gate browser access.
3. API keys remain available for automation and extension traffic.

## Architectural Decisions

1. Reuse existing `user` table as source of truth.
2. Slug is auto-generated uniquely from email local-part and can be edited later.
3. Magic-link email provider: Resend (with provider abstraction to allow future swap).
4. Token replay protection: one-time use verification token storage (hashed token storage).
5. Multi-user mode does not use CF Access for app identity resolution.
6. Multi-user signup is self-serve and is finalized only on successful magic-link verification for a new email.

## Auth Resolution Order by Mode

### `AUTH_MODE=multi-user`

1. App session cookie (`fr_session`) -> authenticated user id.
2. API key bearer token -> authenticated user id.
3. Otherwise `401`.

### `AUTH_MODE=single-user`

1. If CF Access is configured (`CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` set):
   1. CF Access cookie (`CF_Authorization`) -> user lookup/create by email.
   2. API key bearer token.
   3. Otherwise `401`.
2. If CF Access is not configured:
   1. API key bearer token.
   2. Auto-auth as sole user (`OWNER_EMAIL` or fallback).

## SaaS Signup Policy (`AUTH_MODE=multi-user`)

### Signup flow (fixed behavior)

1. user enters email at `/login`.
2. backend validates and normalizes email.
3. send magic link.
4. on successful link verification, if user does not exist, create user row with unique slug.
5. create session.

### Abuse controls (deferred)

1. Explicitly out of scope for the current implementation phase.
2. Keep generic login response and one-time short-TTL tokens; defer rate limits and disposable-email filters.

## Data Model and Migration Plan

Create migration: `packages/db/migrations/0005_auth_hybrid.sql`.

### 1) Extend existing `user` table

1. Add `email_verified INTEGER NOT NULL DEFAULT 0`.
2. Keep existing unique constraints on `email` and `slug`.

### 2) Add auth core tables

1. `session`
   1. `id TEXT PRIMARY KEY`
   2. `user_id TEXT NOT NULL`
   3. `token_hash TEXT NOT NULL UNIQUE`
   4. `expires_at TEXT NOT NULL`
   5. `ip_address TEXT`
   6. `user_agent TEXT`
   7. `created_at TEXT NOT NULL`
   8. `updated_at TEXT NOT NULL`

2. `verification`
   1. `id TEXT PRIMARY KEY`
   2. `identifier TEXT NOT NULL UNIQUE` (Better Auth stores the hashed token here; used as lookup key)
   3. `value_hash TEXT NOT NULL` (Better Auth stores a JSON payload `{"email":"...","name":"..."}` here)
   4. `expires_at TEXT NOT NULL`
   5. `used_at TEXT`
   6. `created_at TEXT NOT NULL`
   7. `updated_at TEXT NOT NULL`

### 3) Add indexes

1. `idx_session_user_id` on `session(user_id)`.
2. `idx_session_expires_at` on `session(expires_at)`.
3. `idx_verification_expires_at` on `verification(expires_at)`.
4. `identifier` UNIQUE constraint provides implicit index (no separate `idx_verification_identifier` needed).

### 4) Test migration constants

Update `packages/db/src/migration-sql.ts` to export `AUTH_HYBRID_SQL` and include it in relevant integration tests.

## Public API / Interface Changes

### New API routes

1. `POST /api/auth/login`
   1. Request body: `{ email: string }`.
   2. Behavior:
      1. normalize + validate email.
      2. call Better Auth magic-link sign-in endpoint and send magic-link email via configured sender.
      3. return generic success response to avoid account enumeration.

2. `GET /api/auth/verify`
   1. On successful magic-link verification in `multi-user`, create user row if absent and then establish session.

3. `GET /api/auth/me`
   1. Returns `authenticated`, `method`, and user profile.

4. `POST /api/auth/logout`
   1. Revokes app session and clears cookie.

## Environment Variables

### Required in `multi-user`

1. `AUTH_MODE=multi-user`.
2. `AUTH_SECRET`.
3. `BETTER_AUTH_URL`.
4. `RESEND_API_KEY`.
5. `RESEND_FROM_EMAIL`.

### Required/optional in `single-user`

1. `AUTH_MODE=single-user` (or unset).
2. `OWNER_EMAIL` (recommended for deterministic owner identity).
3. Optional CF Access vars:
   1. `CF_ACCESS_TEAM_DOMAIN`.
   2. `CF_ACCESS_AUD`.

### Optional in all modes

1. No additional auth vars required.

## Implementation Plan (File-by-File)

### A) Better Auth integration

1. Add official package dependency in `apps/web/package.json`:
   1. `better-auth` (native D1 support, no separate adapter needed).

2. Create `apps/web/src/lib/better-auth.ts`:
   1. Configure Better Auth for Cloudflare D1 (pass `D1Database` binding directly).
   2. Configure magic-link plugin and sender callback (Resend, with console fallback for local dev).
   3. Map Better Auth field names to existing snake_case DB columns.
   4. Configure session cookie name as `fr_session`.
   5. **Verification field mapping:** Better Auth stores the hashed token in its `identifier` field and a JSON payload (`{"email":"...","name":"..."}`) in its `value` field. Map `identifier → "identifier"` and `value → "value_hash"`. The UNIQUE constraint is on `identifier` (hashed token).
   6. Slug generation reuses `generateUniqueSlug()` from `@focus-reader/db` (single implementation shared with CF Access user creation path).
   7. Instance is cached per isolate lifetime (module-level cache in `getBetterAuth()`).
   8. Better Auth handles all session and verification CRUD internally via its ORM — no custom session management code needed.

3. Create `apps/web/src/app/api/auth/[...all]/route.ts`:
   1. Wire Better Auth Next.js handler endpoints for multi-user mode.

### B) Mode-aware auth resolver

1. Update `apps/web/src/lib/auth-middleware.ts`:
   1. Read `AUTH_MODE`.
   2. If `multi-user`:
      1. Better Auth session check first.
      2. API key fallback.
      3. Never use CF Access path.
   3. If `single-user`:
      1. Use existing `authenticateRequest` path (CF/API key/auto-auth behavior).

2. Update `packages/api/src/auth.ts`:
   1. Keep it authoritative for API key and single-user CF/auto-auth paths.
   2. Clarify docstrings and logic for single-user CF enforcement path.
   3. Ensure no implicit CF usage when caller is in multi-user mode.
   4. Keep API key behavior unchanged in both modes.

### C) Auth routes and pages

1. Create `apps/web/src/app/api/auth/login/route.ts`:
   1. Validate email.
   2. Trigger magic-link issuance only.
   3. User creation is handled in successful verify path.

2. Create `apps/web/src/app/api/auth/me/route.ts`:
   1. Return normalized auth state and method.

3. Create `apps/web/src/app/api/auth/logout/route.ts`:
   1. Sign out app session.

4. Create UI pages:
   1. `apps/web/src/app/(auth)/layout.tsx`.
   2. `apps/web/src/app/(auth)/login/page.tsx`.
   3. `apps/web/src/app/(auth)/verify/page.tsx`.

5. Create user context:
   1. `apps/web/src/lib/user-context.tsx`.
   2. In `multi-user`, redirect unauthenticated users to `/login`.
   3. In `single-user`, no redirect (preserve current UX).

### D) DB user helpers and slug generation hardening

1. Update `packages/db/src/queries/admin.ts`:
   1. Export `normalizeSlugBase()` and `generateUniqueSlug()` — single implementation used by both Better Auth's `databaseHooks` and the CF Access `createUserByEmail()` path.
   2. Keep `getOrCreateSingleUser()` strictly single-user fallback only.
   3. Add helper `createUserByEmail()` behavior docs for multi-user self-serve signup.

2. `packages/db/src/queries/auth-session.ts`:
   1. Low-level DB query helpers for session and verification tables (create, read, delete, cleanup).
   2. Used for admin/maintenance operations. Better Auth handles its own session/verification CRUD at runtime.

### E) Configuration and docs

1. Update `apps/web/src/lib/bindings.ts` env interface for new vars.
2. Update `.dev.vars.example` with auth + Resend examples for multi-user local testing.
3. Update `scripts/sync-secrets.sh` to include optional auth vars for local workflows.
4. Update `cloudflare-installation-instructions.md` with new mode-specific matrix.
5. Update root `AGENTS.md` quick reference for mode-scoped auth behavior.

## Security Requirements

1. Magic links must be one-time use and time-bound.
2. Never leak whether an email exists in `POST /api/auth/login` response.
3. Multi-user mode must not trust CF Access identity for app auth.
4. API key auth remains user-scoped and mode-agnostic.
5. Session cookie must be `HttpOnly`, `Secure` in production, and `SameSite=Lax`.

## Testing Plan

### Unit tests

1. `packages/api/src/__tests__/auth.test.ts`:
   1. Single-user behavior unchanged with/without CF Access.
   2. API key path unchanged.

2. Add auth adapter/unit tests in `apps/web`:
   1. Session parsing and method precedence.
   2. Login route generic response behavior.

### DB tests

1. `packages/db/src/__tests__/schema-drift.test.ts`:
   1. Include new auth tables and columns.

2. `packages/db/src/__tests__/...`:
   1. Slug collision and idempotent user creation by email.

### Web API tests

1. `apps/web/src/__tests__/api/auth*.test.ts`:
   1. `multi-user`: session + API key only; no CF Access auth.
   2. `single-user` with CF configured: CF/API key required.
   3. `single-user` without CF configured: auto-auth works.
   4. `GET /api/auth/me` returns correct `method` label.
   5. Browser extension-style API key call succeeds in both modes.

### End-to-end scenarios

1. Multi-user fresh signup:
   1. Request login link.
   2. Verify link.
   3. Access authenticated route.
   4. Confirm isolated user context.
   5. Confirm API key-based extension request works for the same user.

2. Single-user localhost:
   1. No credentials.
   2. Access protected route returns success.

3. Single-user with CF:
   1. No CF cookie -> 401.
   2. Valid CF cookie -> success.

4. API key in both modes:
   1. Valid key succeeds.
   2. Invalid key returns 401.
   3. Extension endpoint calls using API key succeed without session cookie.

### Required validation command

Run before merge:

```bash
pnpm build && pnpm typecheck && pnpm test
```

## Rollout Plan

1. Land migration + code together.
2. Staging deploy with explicit mode testing:
   1. `AUTH_MODE=multi-user` flow validation.
   2. `AUTH_MODE=single-user` flow validation (with and without CF vars).
   3. Production deploy.
   4. Keep fallback path:
      1. If session/magic-link issue occurs in multi-user, temporarily disable login entrypoints while preserving API-key access for emergency operations.

## Acceptance Criteria

1. Multi-user mode supports magic-link session auth and API keys only.
2. Single-user mode supports auto-auth and optional CF Access perimeter auth.
3. API keys work in both modes, including extension calls.
4. Local dev default remains frictionless.
5. VPN-like self-hosted use cases are supported via single-user + optional CF Access.
6. No regressions in row-level `user_id` isolation.
7. New multi-user email signup works through first successful magic-link flow.
8. All build/typecheck/tests pass.

## Assumptions

1. Session/magic-link auth can be integrated cleanly into Next.js + Cloudflare runtime in `apps/web`.
2. Reusing existing `user` table with schema extension is acceptable.
3. Resend is acceptable as initial transactional provider.
