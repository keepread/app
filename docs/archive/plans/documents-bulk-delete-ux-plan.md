# Documents Bulk Delete + Selection Mode Plan

## Goal
Add bulk-delete capabilities to document lists (Inbox/Later/Archive/etc.) with a subtle UI:
- explicit selection mode
- no always-visible checkboxes
- bulk delete for selected documents
- right-panel hover/selection behavior preserved

## Current Status
Implemented and passing web checks, not yet committed.

## Scope Implemented

### 1. Backend bulk-delete primitives
- Reused list filter logic for counting/listing/deleting documents by query.
- Added batch soft-delete by IDs with user scoping.

Files:
- `packages/db/src/queries/documents.ts`
  - Added:
    - `buildDocumentFilters(...)` (shared internal helper)
    - `countDocumentsByQuery(...)`
    - `listDocumentIdsByQuery(...)`
    - `softDeleteDocumentsByIds(...)`
  - `listDocuments(...)` now uses shared filter builder.

### 2. API package surface
- Added API-layer bulk delete + preview functions.

Files:
- `packages/api/src/documents.ts`
  - Added:
    - `previewBulkDeleteDocuments(...)`
    - `bulkDeleteDocuments(...)`
    - input types for selected/filtered scopes

### 3. Web API routes
- Added bulk-delete execution route.
- Added bulk-delete preview route.

Files:
- `apps/web/src/app/api/documents/bulk-delete/route.ts`
- `apps/web/src/app/api/documents/bulk-delete/preview/route.ts`

### 4. Documents list/grid UI
- Added explicit "selection mode" workflow.
- Checkboxes only appear in selection mode.
- Title dropdown hosts selection actions.
- Added visible inline `Done` control to exit selection mode.
- `Select all`, `N selected`, and `Clear` moved next to title for discoverability.
- Removed confusing `Delete all filtered` from toolbar flow.
- Auto-reset selection mode when changing route/view.

Files:
- `apps/web/src/components/documents/document-list.tsx`
- `apps/web/src/components/documents/document-list-toolbar.tsx`
- `apps/web/src/components/documents/document-list-item.tsx`
- `apps/web/src/components/documents/document-card.tsx`
- `apps/web/src/components/documents/document-grid.tsx`

### 5. Tests
- Added web API tests for bulk-delete routes.

File:
- `apps/web/src/__tests__/api/documents-bulk-delete.test.ts`

## UX Behavior (Final)
- Open title dropdown (`Inbox`/`Later`/etc.) -> `Select documents`.
- Checkboxes appear in rows/cards.
- Inline controls by title:
  - `Select all` / `Clear all`
  - `N selected`
  - `Clear`
  - `Done` (exit selection mode)
- Dropdown still exposes:
  - `Exit selection mode`
  - `Delete selected (N)`
- On route change (e.g. Inbox -> Later), selection mode and selection set reset.

## Verification Run
Executed successfully:
- `pnpm --filter @focus-reader/db build`
- `pnpm --filter @focus-reader/db typecheck`
- `pnpm --filter @focus-reader/api build`
- `pnpm --filter @focus-reader/api typecheck`
- `pnpm --filter @focus-reader/api test`
- `pnpm --filter focus-reader-web typecheck`
- `pnpm --filter focus-reader-web test`
- `pnpm --filter focus-reader-web build`

Known environment note:
- `pnpm --filter @focus-reader/db test` exited early in this environment without detailed test output.

## Resume / Recovery Steps
If rebasing/pulling goes wrong:
1. Confirm local changes:
   - `git status --short`
2. Restore this implementation from file list above (or from stash/cherry-pick).
3. Re-run:
   - `pnpm --filter @focus-reader/api build && pnpm --filter @focus-reader/api typecheck`
   - `pnpm --filter focus-reader-web typecheck && pnpm --filter focus-reader-web test`
4. Manually validate in UI:
   - enter selection mode from title menu
   - select/deselect items
   - delete selected
   - exit with `Done`
   - switch route and ensure selection mode resets
