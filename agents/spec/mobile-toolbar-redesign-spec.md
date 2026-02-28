# Mobile Toolbar Redesign — Spec

**Version:** 1.1
**Date:** February 27, 2026
**Status:** Implemented
**Scope:** `DocumentListToolbar` + `SearchBar` + `DocumentList` + `BulkActionBar` (new)

---

## Problem Statement

The `DocumentListToolbar` had two usability failures on mobile:

1. **Overflow:** Search input + type filter + sort dropdown + view toggle didn't fit on one
   line at mobile widths, causing awkward two-line wrapping.
2. **Bulk selection UX was buried and cluttered:** Entering selection mode required finding
   it inside the title chevron dropdown. In bulk mode, action buttons wrapped into a second
   line. Scope controls ("Select all", "Select all matching") and action buttons ("Archive",
   "Delete") were spread across both ends of the toolbar with no clear grouping. "Select all
   matching" was hidden on mobile entirely.

---

## Solution Overview

Two independent improvements:

- **A. Toolbar compaction** — collapse search and filter controls to icons on mobile
- **B. Bulk selection redesign** — Gmail-style scope dropdown + actions adjacent to selection controls

---

## A. Toolbar Compaction

### A.1 Search: expandable icon (mobile only)

**Mobile (`sm` breakpoint and below):**
- Shows a `Search` icon button in place of the full input
- Tapping expands inline, the full-width input + X dismiss button replaces the right cluster
- Dismissing collapses back to icon state and clears the query
- While expanded, all other right-side controls are hidden

**Desktop (`sm` and above):**
- Always-visible text input — no change
- `SearchBar` has a `compact` prop (`compact`, `expanded`, `onExpandedChange`) to support
  both behaviours from the same component

### A.2 Filters: merged icon button

The two separate dropdowns ("All Types" + "Date saved / Sort") are collapsed into a single
`SlidersHorizontal` icon button.

**Mobile:** Opens a **bottom Sheet** (`shadcn/ui Sheet`, `side="bottom"`) containing:
- Type filter section
- Sort by section
- Sort direction section
- "Done" close button

**Desktop:** Opens a `DropdownMenu` with the same sections using `DropdownMenuLabel`
separators.

A small blue dot on the button signals when a non-default filter or sort is active.

### A.3 View mode toggle

List/grid toggle stays in the toolbar on both desktop and mobile — no change.

### A.4 Title chevron

Kept as-is for now (contains "Select documents" as a secondary entry point). To be
re-evaluated once the new layout is stable.

### Resulting toolbar layout

**Normal mode, mobile:**
```
[☰?]  [Title ▾]  [☐▾]              [view toggle]  [🔍]  [⚙]
```

**Normal mode, desktop:**
```
[☰?]  [Title ▾]  [☐▾]    [___ search input ___]  [⚙]  [view toggle]  [▷ panel]
```

**Search active (mobile — expanded):**
```
[________ search input ________] [✕]
```
_(all other right-side controls hidden while search is open)_

---

## B. Bulk Selection Redesign

### B.1 Entry point: Gmail-style `[☐▾]` scope dropdown

A compact `[checkbox-icon ▾]` button replaces the hidden-in-chevron entry point. It is
always visible next to the title when `onToggleBulkMode` is provided.

The checkbox icon reflects selection state:
- `Square` — nothing selected
- `SquareMinus` — partial selection
- `SquareCheck` — all visible or all matching selected

**In normal mode**, the dropdown opens with scope-entry options that both enter bulk mode
and apply the chosen scope in a single click:
- "Select All" — enters bulk mode + selects all visible
- "Select All Matching (N)" — enters bulk mode + selects all matching (only when
  `matchingCount > 0`)

**In bulk mode**, the dropdown changes scope without exiting bulk mode:

| Current state | Items shown |
|---|---|
| Nothing selected | "Select All", "All Matching (N)" |
| Some selected | "Select All", "All Matching (N)", — "None" |
| All visible selected | "All Matching (N)", — "None" |
| All matching selected | "Visible Only", — "None" |

- **"Select All"** — only shown when not all visible are selected; always selects the
  currently loaded/visible items
- **"All Matching (N)"** / **"Visible Only"** — scope toggle for paginated lists; only
  shown when `matchingCount > 0`
- **"None"** — always clears selection to 0 without exiting bulk mode (shown only when
  something is selected)

These are explicit, non-toggling items. There is no ambiguous "Clear All" toggle.

### B.2 Bulk mode — toolbar

```
[✕ Done]  [N selected]  [☐▾]  |  [Archive]  [Later]  [Delete]
```

- `✕ Done` exits bulk mode
- "N selected" / "N matching" — count label (label changes via `selectedLabel` prop)
- `[☐▾]` — scope dropdown (see B.1)
- Separator + action buttons — **desktop only** (mobile uses `BulkActionBar` at bottom)
- Action button labels show no count — the count is already visible in "N selected"
- The entire right cluster (search, filter, view toggle) is hidden in bulk mode

### B.3 Bulk mode — floating action bar (mobile)

```
┌─────────────────────────────────┐
│  [Archive]  [Later]  [Delete]   │
└─────────────────────────────────┘
```

- `sm:hidden sticky bottom-0`, full width, `border-t bg-background shadow-md`
- `flex-1` buttons for equal widths; "Delete" uses `text-destructive`
- Disabled when 0 items selected or during an in-flight bulk operation

### B.4 Confirmation for delete

The existing `window.confirm` for delete is a known issue (blocks browser events in
automation). Out of scope for this spec — leave as-is for now.

---

## Component Changes Summary

| Component | Changes |
|---|---|
| `SearchBar` | Added `compact`, `expanded`, `onExpandedChange` props for icon-first mobile behaviour |
| `DocumentListToolbar` | Gmail-style `[☐▾]` scope dropdown; bulk mode left cluster with adjacent action buttons (desktop); right cluster hidden in bulk mode; two filter dropdowns merged into one `SlidersHorizontal` button |
| `DocumentList` | Bug fix: "Visible Only" now restores visible selection instead of clearing to 0; renders `BulkActionBar` at bottom |
| `BulkActionBar` (new) | Mobile-only sticky bottom bar with Archive / Later / Delete |

---

## Decisions Log

| # | Decision |
|---|---|
| 1 | Desktop search keeps the full visible text input; icon-only is mobile-only |
| 2 | Merged filter panel opens as a bottom Sheet on mobile, DropdownMenu on desktop |
| 3 | Title chevron kept as-is for now, to be revisited once new layout is stable |
| 4 | View mode toggle (list/grid) stays in the toolbar on both desktop and mobile |
| 5 | Action buttons show no count — count is already shown in "N selected" label |
| 6 | Scope dropdown uses explicit items (no toggles) to avoid "Clear All" vs "None" ambiguity |
| 7 | Action buttons (Archive/Later/Delete) placed adjacent to scope controls on desktop, not at the far right |
