# Web App Architecture

This document describes the current `apps/web` architecture (Next.js 15 App Router).

## Route Topology

Reader routes (`app/(reader)`):

- Core lists: `/inbox`, `/later`, `/archive`, `/all`, `/starred`
- Feature routes: `/highlights`, `/tags`, `/feeds`, `/views/[id]`, `/subscriptions/[id]`, `/collections/[id]`
- Reading mode: enabled by query param `?doc=<documentId>` on list/entity routes

Auth routes (`app/(auth)`):

- `/login`, `/verify`, `/onboarding`

Settings routes:

- `/settings` and section pages under `/settings/*`

## Layout and State Model

Top-level shell stack:

- `ReaderLayout` (server): redirects unauthenticated/needs-onboarding users in multi-user mode
- `ReaderLayoutClient` (client): SWR provider + `UserProvider` + `AppProvider`
- `AppShell`: runtime layout switch between list mode and reading mode

`AppContext` manages UI-only shell state:

- selected/hovered entity IDs
- keyboard-selected list index
- left/right panel visibility
- TOC visibility
- content mode (`html`/`markdown`)
- focus mode

## Authentication Wiring

- API routes use `withAuth(request, handler)`
- `resolveAuthUser()` checks Better Auth session in `multi-user` mode first
- Falls through to shared `authenticateRequest()` for API key and single-user flows
- All downstream DB operations are scoped with `scopeDb(db, userId)`

## API Route Pattern

Canonical route flow:

1. Enter route handler (`app/api/**/route.ts`)
2. Run `withAuth` to resolve `userId`
3. Get bindings from `src/lib/bindings.ts`
4. Create `UserScopedDb` with `scopeDb`
5. Call `@focus-reader/api` business function
6. Return JSON using `json`/`jsonError` helpers (+ CORS wrapper where needed)

## Client Data Pattern

- SWR hooks in `src/hooks/*` (`useDocuments`, `useTags`, `useFeeds`, etc.)
- Shared fetch helper `apiFetch()` with normalized error handling
- Local cache invalidation via `documents-cache.ts` and hook-level `mutate`

## Reader Surface

Reading mode components:

- `ReaderToolbar`: document actions, navigation, focus mode, panel toggles
- `ReaderContent`: HTML/Markdown rendering, PDF fallback, highlights, progress sync
- `ReaderToc`: heading index for active document
- `RightSidebar`: info/notebook tabs (or tag/feed detail panels on those routes)

## Notable Features

- Highlights with color/note/tag support
- Collections with add/remove and route-level views
- Saved views and search routes
- Export endpoints (JSON, Markdown)
- Cover image proxy and caching support
- Command palette + keyboard shortcut layer

For UI behavior details, use `docs/product/ui-spec-current.md`.
