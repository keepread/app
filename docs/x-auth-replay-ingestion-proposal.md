# X Auth Replay Ingestion Proposal

## Goal

Enable reliable ingestion of `x.com`/`twitter.com` URLs by using the logged-in browser session from the extension to replay authenticated X requests, with fallback paths when replay fails.

## Problem Summary

Current generic extraction fails for some X URLs because both direct fetch and browser-rendered fetch return a JS interstitial shell instead of tweet content. As a result:

- Readability cannot extract meaningful article content.
- Sanitization removes `<noscript>` interstitial text.
- Final extracted word count is `0`.

## Proposed Solution

Implement a domain-specific X ingestion pipeline:

1. Extension captures X auth headers from real browser requests while user is logged in.
2. Extension syncs a short-lived replay bundle to backend.
3. Backend replays X request to fetch tweet payload.
4. Backend normalizes tweet data into internal article-like HTML/markdown.
5. Backend falls back to public endpoints (`syndication`, `oEmbed`) if replay fails.
6. Link-only tweets are resolved and ingested as full article content when possible.

## Architecture

### 1) Extension Capture Layer (`apps/extension`)

Add an extension module that observes outbound X API requests and captures a whitelisted header set.

Permissions:

- Host permissions: `https://x.com/*`
- APIs: `webRequest`, `storage`, `cookies` (if needed)

Capture target:

- `https://x.com/i/api/graphql/*`

Header allowlist:

- `authorization`
- `x-csrf-token`
- `x-guest-token` (if present)
- `x-twitter-auth-type`
- `x-twitter-active-user`
- `cookie`
- `user-agent`
- `accept`
- `accept-language`

Persist in extension storage with timestamp and endpoint template.

### 2) Session Sync API (`apps/web` route + `packages/api`)

Create endpoint:

- `POST /api/integrations/x/session/sync`

Request payload:

```json
{
  "endpointTemplate": "https://x.com/i/api/graphql/.../TweetDetail",
  "method": "GET",
  "headers": {
    "authorization": "Bearer ...",
    "x-csrf-token": "...",
    "cookie": "...",
    "x-twitter-auth-type": "...",
    "x-twitter-active-user": "yes",
    "user-agent": "...",
    "accept": "...",
    "accept-language": "en-US,en;q=0.9"
  },
  "capturedAt": "2026-03-02T00:00:00.000Z"
}
```

Response:

```json
{
  "ok": true,
  "expiresAt": "2026-03-02T02:00:00.000Z"
}
```

### 3) Secure Storage (`packages/db`)

Add table `x_session_replay`:

- `user_id` (PK component)
- `endpoint_template`
- `headers_encrypted`
- `captured_at`
- `expires_at`
- `last_success_at`
- `last_error`
- `created_at`
- `updated_at`

Security:

- Encrypt headers at rest with a Worker secret key.
- Never log raw headers or cookies.
- Keep TTL short (recommended: 1-2 hours).

### 4) X Fetcher (`packages/api/src/x-fetcher.ts`)

Create a dedicated fetcher:

- Input: `userId`, `tweetId`, `url`
- Flow:
  1. Load freshest valid replay bundle for user.
  2. Construct request to X endpoint for tweet detail.
  3. Replay whitelisted headers.
  4. Parse JSON response and normalize.
  5. Return structured extraction result.

Normalization target fields:

- `title`
- `author`
- `siteName`
- `publishedDate`
- `excerpt`
- `wordCount`
- `htmlContent`
- `markdownContent`
- `coverImageUrl`
- `media[]`
- `canonicalUrl`

### 5) Ingestion Routing (`packages/api` document flow)

For `x.com`/`twitter.com` URLs:

1. `x-fetcher` replay path
2. Fallback `cdn.syndication.twimg.com/tweet-result`
3. Fallback `publish.twitter.com/oembed`
4. Final fallback generic HTML extraction

For link-only tweets:

- Resolve expanded URL(s) from tweet entities.
- If first-class article URL exists, ingest that content as primary body.
- Keep tweet content as attribution/context block.

### 6) Feature Flag and Kill Switch

Add env flag:

- `X_AUTH_REPLAY_ENABLED=true|false`

If disabled, skip replay path and use fallback ladder.

## Reliability Strategy

- Refresh replay bundle passively whenever extension observes valid X request.
- Mark bundle stale on `401/403`.
- Use exponential backoff for transient `429/5xx`.
- Cache normalized tweet payload by tweet ID for a short window to reduce replay volume.
- Keep fallback paths active even when replay is enabled.

## Security and Operational Guardrails

- Strict header allowlist only.
- Redact secrets in all logs and traces.
- Encrypt header payloads in DB.
- Short TTL with auto-expiry cleanup.
- Per-user isolation via `UserScopedDb`.

## Implementation Plan

### Phase 1: Data and API Scaffolding

1. Add D1 migration for `x_session_replay`.
2. Add DB query helpers for upsert/get/mark-stale.
3. Add `POST /api/integrations/x/session/sync` route and API handler.
4. Add encryption/decryption utility for replay headers.

### Phase 2: Extension Capture and Sync

1. Implement `webRequest` listener for X GraphQL requests.
2. Filter to allowed headers.
3. Store latest valid bundle in extension storage.
4. Sync bundle to backend on capture and periodically.

### Phase 3: Backend Replay Fetcher

1. Implement `x-fetcher.ts` with request builder and response parser.
2. Normalize tweet payload to article-like structure.
3. Add retry classification (`retryable`, `non-retryable`).
4. Add telemetry events/metrics.

### Phase 4: Pipeline Integration and Fallbacks

1. Add host-based routing in document ingestion.
2. Integrate replay path for X domains.
3. Add syndication and oEmbed fallback adapters.
4. Add link-only tweet promotion to linked article fetch.

### Phase 5: Tests and Validation

Unit tests:

- Header filtering and redaction
- Session TTL/staleness behavior
- Replay response parsing
- Fallback selection and ordering

Integration tests:

- Replay success path
- Replay `401` to fallback path
- Replay `429` retry then fallback
- Link-only tweet URL promotion

Manual validation:

- Re-test failing URLs:
  - `https://x.com/sawyerhood/status/2027409021914026093`
  - `https://x.com/bcherny/status/2027534984534544489`
- Confirm non-zero word counts and meaningful titles.

## Open Decisions

1. Whether to keep `cookie` in replay allowlist or rely on bearer + csrf only.
2. Exact endpoint contract to request tweet detail from X.
3. Max cache TTL for normalized tweet payload.
4. How to represent quoted tweets and thread replies in markdown output.

## Success Criteria

- X URLs ingest with meaningful body text in normal cases.
- Failures degrade gracefully through fallback ladder.
- No secret headers appear in logs.
- Existing non-X extraction behavior remains unchanged.

