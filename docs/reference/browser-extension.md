# Browser Extension (Reference)

**Status:** Live  
**Last validated:** 2026-02-28

## Location

`apps/extension`

## Current Surface

The extension is built with WXT + React and currently includes:

- Popup app (`src/entrypoints/popup`)
- Side panel app (`src/entrypoints/sidepanel`)
- Options app (`src/entrypoints/options`)
- Background service worker (`src/entrypoints/background.ts`)

## Primary Capabilities

- Save current page as article/bookmark into Focus Reader
- Tag selection from popup when saving
- API URL/API key configuration via options
- Background messaging and request orchestration

## Core Modules

- `src/lib/api-client.ts`: extension API client for Focus Reader endpoints
- `src/lib/messaging.ts`: cross-entrypoint messaging helpers
- `src/components/*`: shared UI pieces for popup/sidepanel

## Integration Contract

The extension talks to Focus Reader web API endpoints over bearer auth (API key). It depends on web API behavior implemented in `apps/web/src/app/api/*`.

## Dev/Test

- Build: `pnpm --filter focus-reader-extension build`
- Test: `pnpm --filter focus-reader-extension test`

## Constraints

- Keep extension auth model aligned with API key behavior in web app
- Avoid duplicating business logic; extension should call server APIs
- Prefer shared types from `@focus-reader/shared` where possible

## Related Docs

- `docs/reference/repo-structure.md`
- `docs/architecture/web-app.md`
- `docs/product/product-spec-current.md`
