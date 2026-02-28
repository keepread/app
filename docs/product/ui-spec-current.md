# Focus Reader UI Spec (Current Implementation)

This spec reflects the UI currently implemented in `apps/web` as of February 2026.

## App Structure

The reader experience is rendered under `app/(reader)` with `AppShell` as the root client shell.

Key routes:

- Library/list views: `/inbox`, `/later`, `/archive`, `/all`, `/starred`
- Entity views: `/highlights`, `/tags`, `/tags/[id]`, `/feeds`, `/feeds/[id]`, `/subscriptions/[id]`, `/collections/[id]`, `/views/[id]`
- Settings: `/settings/*`
- Auth: `/login`, `/verify`, `/onboarding` (used in `AUTH_MODE=multi-user`)

## Primary Layout Modes

`AppShell` has two modes based on `?doc=`:

1. List mode (`?doc` absent):
   - Left nav sidebar (desktop) or sheet (mobile)
   - Main list/content pane (route children)
   - Right sidebar panel (document/tag/feed detail)
2. Reading mode (`?doc=<documentId>` present):
   - TOC panel (desktop, unless focus mode)
   - Reader toolbar + reader content
   - Right sidebar panel (unless focus mode)

Mobile behavior:

- Left and right sidebars are sheet overlays
- Desktop panel state is saved/restored when switching mobile/desktop

## Navigation and Sidebars

Left nav (`NavSidebar`) includes:

- System views: Inbox, Later, Archive, All, Starred, Highlights, Tags, Feeds
- Subscriptions section
- Collections section (create supported inline)
- Saved Views section
- User menu

Right sidebar (`RightSidebar`) behavior:

- On `/tags`, shows tag detail panel
- On `/feeds`, shows feed detail panel
- Else shows document tabs:
  - `Info`: metadata, tags, collections, source details
  - `Notebook`: document highlights list with quick navigation

## Reader Experience

Reader components:

- `ReaderToolbar`: navigation, move/archive, star, read state, tags, collections, focus mode, TOC toggle, right-panel toggle
- `ReaderContent`: renders HTML or Markdown mode, PDF viewer for PDFs, highlight interactions, reading progress tracking
- `ReaderToc`: heading navigation for active document

Content behavior:

- Auto-mark as read after opening
- Scroll progress persisted (`reading_progress`, `last_read_at`)
- Relative links/images resolved against source URL
- Image sources proxied through `/api/image-proxy`

## Keyboard Shortcuts

Implemented shortcuts include:

- Navigation: `j/k`, `ArrowUp/ArrowDown`, `Enter`, `Escape`
- Panel/layout: `[`, `]`, `f` (focus mode in reader), `Shift+H` (HTML/Markdown)
- Document actions: `s`, `Space`, `e`, `Shift+E`, `l`, `d`, `t`, `o`, `Shift+C`
- Global: `a`, `/`, `?`, `Cmd+K`, `Ctrl+K`
- Reader-only highlight quick action: `h` for yellow highlight from selection

## Command Palette

`CommandPalette` (Cmd/Ctrl+K) supports:

- Route navigation (Inbox/Later/Archive/Starred/All)
- Search focus
- Add URL
- Create collection
- Highlights navigation
- Focus mode toggle
- Theme toggle
- Settings and export shortcuts

## Settings IA

Current settings sections:

- General
- Subscriptions
- Feeds
- Denylist
- Email
- Ingestion Log
- API Keys
- Export

## Auth UX

Mode-dependent behavior:

- `multi-user`: login and verify pages enabled, onboarding gate enforced before reader routes
- `single-user`: no login redirect; auth handled by CF Access/API key/auto-auth

## Known Drift Against Legacy UI Spec

`docs/archive/specs/focus-reader-ui-spec-v1.md` includes historical designs and path/component names that no longer match implementation (example: `/inbox/read/[id]`, `components/layout/sidebar.tsx`).

Use this document for implementation-accurate UI behavior.
