# Phase 3 Implementation Plan: Highlighting, Collections, Preferences, and Export

**Version:** 1.0
**Date:** February 15, 2026
**Status:** Pending — Steps 21–28 pending
**Prerequisites:** Phase 2 complete (see `phase-2-plan.md`)

---

## 1. Phase 3 Scope

Phase 3 transforms Focus Reader from a daily-driver reading app into a full Readwise Reader replacement. It adds highlighting and annotations, collections (reading lists), customizable reading preferences, and comprehensive data export.

### 1.1 What Phase 2 Already Provides

- **RSS feed ingestion** — `apps/rss-worker` with Cron Triggers, feed parser, feed management UI
- **Full-text search** — FTS5 virtual table, search UI with `/` shortcut
- **Browser extension** — Chrome MV3 extension with WXT, saves articles/bookmarks, tag picker
- **Auth enforcement** — CF Access JWT + API key authentication on all routes
- **Keyboard navigation** — j/k document navigation, Cmd+K command palette
- **Auto-tagging rules** — per-subscription and per-feed rules evaluated on ingestion
- **Saved views** — query-based filtered views in sidebar
- **PDF upload/viewing** — R2 storage, PDF.js viewer
- **Dark mode** — Theme toggle, `next-themes` with CSS variables
- **Test coverage** — 364 tests across all packages

### 1.2 What Phase 3 Adds

1. **Highlighting and annotation system** — Text selection creates highlights with colors, notes, position selectors for re-anchoring
2. **Highlight tags and notebook view** — Tag highlights separately from documents, notebook tab in right sidebar, global highlights view
3. **Collections (reading lists)** — Named ordered groups of documents, drag-and-drop reordering, sidebar section
4. **Customizable reading preferences** — Font family, font size, line height, content width via CSS custom properties
5. **Full data export** — JSON export (all data), Markdown export (single doc with YAML frontmatter, bulk ZIP, highlights-only), copy-as-markdown

### 1.3 What's Out (deferred to Phase 4+)

- Social media post saving (Phase 4)
- AI summarization (Phase 4)
- Atom feed output (Phase 4)
- Import from Instapaper/Pocket/Omnivore (Phase 4)
- LLM-based auto-tagging (Phase 4)

---

## 2. New Dependencies

| Package | Workspace | Purpose |
|---|---|---|
| `jszip` | `apps/web` | Bulk Markdown export as ZIP archive |
| `js-yaml` | `packages/parser` | YAML frontmatter generation for Markdown export |
| `@dnd-kit/core` | `apps/web` | Drag-and-drop reordering for collection documents |
| `@dnd-kit/sortable` | `apps/web` | Sortable list utilities for drag-and-drop |

No new workspace apps needed — all work is within existing packages and `apps/web`.

---

## 3. Database

All tables needed already exist in `0001_initial_schema.sql`:

- `highlight` — id, document_id, text, note, color (default #FFFF00), position_selector, position_percent, created_at, updated_at
- `highlight_tags` — highlight_id, tag_id (join table)
- `collection` — id, name, description, created_at, updated_at
- `collection_documents` — collection_id, document_id, sort_order, added_at (join table)
- `user_preferences` — id, schema_version, theme, font_family, font_size, line_height, content_width, shortcut_map_json, view_mode_prefs_json, updated_at

### Optional Migration `0003_highlight_collection_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_highlight_document_id ON highlight(document_id);
CREATE INDEX IF NOT EXISTS idx_highlight_created_at ON highlight(created_at);
CREATE INDEX IF NOT EXISTS idx_collection_documents_sort ON collection_documents(collection_id, sort_order);
```

---

## 4. Implementation Steps

Steps continue numbering from Phase 2 (Steps 10–20).

---

### Step 21: Highlight DB Queries + API Layer (Foundation)

**Goal:** Create the complete data layer for highlights — query helpers, business logic, types, and API routes.

**Packages:** `packages/shared`, `packages/db`, `packages/api`, `apps/web`

#### 21a: Shared Types

**Update `packages/shared/src/types.ts`:**

```typescript
export type HighlightColor = "#FFFF00" | "#90EE90" | "#87CEEB" | "#DDA0DD" | "#FF6B6B";

export interface PositionSelector {
  type: "TextPositionSelector";
  cssSelector: string;
  startOffset: number;
  endOffset: number;
  surroundingText: {
    prefix: string;    // ~30 chars before
    exact: string;     // the highlighted text
    suffix: string;    // ~30 chars after
  };
}

export interface CreateHighlightInput {
  id?: string;
  document_id: string;
  text: string;
  note?: string | null;
  color?: string;
  position_selector?: string | null;  // JSON-serialized PositionSelector
  position_percent?: number;
}

export interface UpdateHighlightInput {
  text?: string;
  note?: string | null;
  color?: string;
}

export interface HighlightWithTags extends Highlight {
  tags: Tag[];
}

export interface HighlightWithDocument extends HighlightWithTags {
  document: Pick<Document, "id" | "title" | "url" | "author" | "type">;
}
```

**Update `packages/shared/src/constants.ts`:** Add `HIGHLIGHT_COLORS` array and `HIGHLIGHT_CONTEXT_LENGTH = 30`.

#### 21b: Database — Highlight Query Helpers

**New file: `packages/db/src/queries/highlights.ts`**

```typescript
export async function createHighlight(db: D1Database, input: CreateHighlightInput): Promise<Highlight>;
export async function getHighlight(db: D1Database, id: string): Promise<Highlight | null>;
export async function getHighlightWithTags(db: D1Database, id: string): Promise<HighlightWithTags | null>;
export async function listHighlightsForDocument(db: D1Database, documentId: string): Promise<HighlightWithTags[]>;
export async function listAllHighlights(
  db: D1Database, options?: { tagId?: string; color?: string; limit?: number; cursor?: string }
): Promise<{ items: HighlightWithDocument[]; total: number; nextCursor?: string }>;
export async function updateHighlight(db: D1Database, id: string, updates: UpdateHighlightInput): Promise<void>;
export async function deleteHighlight(db: D1Database, id: string): Promise<void>;
export async function addTagToHighlight(db: D1Database, highlightId: string, tagId: string): Promise<void>;
export async function removeTagFromHighlight(db: D1Database, highlightId: string, tagId: string): Promise<void>;
export async function getHighlightCountForDocument(db: D1Database, documentId: string): Promise<number>;
```

- `listHighlightsForDocument()` ordered by `position_percent ASC` (document order)
- `listAllHighlights()` joins with `document` table, ordered by `created_at DESC`, cursor pagination
- `deleteHighlight()` also deletes from `highlight_tags` (D1 FK cascades not enforced)

#### 21c: API — Highlight Business Logic

**New file: `packages/api/src/highlights.ts`**

```typescript
export async function getHighlightsForDocument(db, documentId): Promise<HighlightWithTags[]>;
export async function getAllHighlights(db, options?): Promise<{items, total, nextCursor}>;
export async function createHighlight(db, input): Promise<HighlightWithTags>;
export async function patchHighlight(db, id, updates): Promise<void>;
export async function removeHighlight(db, id): Promise<void>;
export async function tagHighlight(db, highlightId, tagId): Promise<void>;
export async function untagHighlight(db, highlightId, tagId): Promise<void>;
```

#### 21d: Web — API Routes + Hook

**New routes:**
- `apps/web/src/app/api/documents/[id]/highlights/route.ts` — GET (list for doc), POST (create)
- `apps/web/src/app/api/highlights/route.ts` — GET (list all with filters)
- `apps/web/src/app/api/highlights/[id]/route.ts` — GET, PATCH, DELETE
- `apps/web/src/app/api/highlights/[id]/tags/route.ts` — POST, DELETE

**New hook: `apps/web/src/hooks/use-highlights.ts`**

#### 21e: Optional Migration — Indexes

`packages/db/migrations/0003_highlight_collection_indexes.sql` + update `migration-sql.ts`

#### 21f: Tests

- `packages/db/src/__tests__/highlights.test.ts` — workerd CRUD + tag + pagination tests
- `apps/web/src/__tests__/api/highlights.test.ts` — route handler tests

**Success criteria:**
- [ ] Highlight CRUD with UUID, timestamps, default color
- [ ] List by document ordered by position_percent
- [ ] List all with document info, cursor pagination
- [ ] Tag/untag + cascading delete of highlight_tags
- [ ] All API routes tested
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 22: Highlight UI in Reader (Text Selection, Color Picker, Inline Rendering)

**Goal:** Enable text selection → highlight creation, color picking, and inline highlight rendering in the reader.

**Packages:** `apps/web`

#### 22a: Text Selection Handler

**New component: `apps/web/src/components/reader/highlight-popover.tsx`**

- Listen for `mouseup`/`touchend` on the reader content container
- Check `window.getSelection()` for non-empty range
- Show floating popover near selection with 5 color buttons + "Note" button
- On color click: create highlight via API
- Extract `PositionSelector` from the Range (CSS selector path + offsets + surrounding text context)
- Compute `position_percent` from vertical position in container

#### 22b: Inline Highlight Rendering

**New component: `apps/web/src/components/reader/highlight-renderer.tsx`**

Re-anchoring algorithm:
1. **Primary:** Use `cssSelector` + `startOffset`/`endOffset` to locate exact range
2. **Fallback:** Text search using `surroundingText.exact` if CSS selector fails
3. Wrap matched text nodes in `<mark>` elements with highlight color as background
4. Each `<mark>` gets `data-highlight-id` for click handling

#### 22c: Highlight Click Popover (Edit/Delete)

**New component: `apps/web/src/components/reader/highlight-detail-popover.tsx`**

- Show on click of existing `<mark>` element
- Color picker, note editor, tag picker, delete button, copy text button

#### 22d: Integration with ReaderContent

**Update `apps/web/src/components/reader/reader-content.tsx`:**

```typescript
const { data: highlights, mutate: mutateHighlights } = useHighlightsForDocument(documentId);

useEffect(() => {
  if (!containerRef.current || !highlights) return;
  applyHighlights(containerRef.current, highlights, handleHighlightClick);
  return () => removeHighlightMarks(containerRef.current);
}, [highlights, htmlContent]);
```

#### 22e: Keyboard Shortcut

**Update `apps/web/src/components/layout/app-shell.tsx`:**
- `h` shortcut: when text is selected, create yellow highlight immediately

**Success criteria:**
- [ ] Text selection shows floating popover with 5 color options
- [ ] Clicking color creates highlight, renders inline immediately
- [ ] Existing highlights re-anchor on document load
- [ ] Clicking inline highlight shows edit popover
- [ ] `h` shortcut creates yellow highlight from selection
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 23: Notebook View + Highlights Management

**Goal:** Enable the Notebook tab in the right sidebar and create a global highlights page.

**Packages:** `apps/web`

#### 23a: Notebook Tab in Right Sidebar

**Update `apps/web/src/components/layout/right-sidebar.tsx`:**

- Enable "Notebook" tab (currently disabled)
- Render list of highlights for current document, ordered by position
- Each card: color bar, text (truncated), note, tags, timestamp
- Click to scroll to highlight in document
- Highlight count badge on tab

**New component: `apps/web/src/components/reader/notebook-highlight-card.tsx`**

#### 23b: Scroll-to-Highlight

```typescript
function scrollToHighlight(highlightId: string) {
  const mark = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);
  mark?.scrollIntoView({ behavior: "smooth", block: "center" });
  // Brief pulse animation
}
```

Add `@keyframes highlight-pulse` to `globals.css`.

#### 23c: Global Highlights Page

**New route: `apps/web/src/app/(reader)/highlights/page.tsx`**

- All highlights across all documents
- Filters: color, tag, text search
- Grouped by document (title as section header)
- Click navigates to `?doc=<id>&highlight=<highlightId>`

#### 23d: Sidebar Navigation

**Update `apps/web/src/components/layout/nav-sidebar.tsx`:**
- Add "Highlights" link with `Highlighter` icon

#### 23e: Reading Progress Visual Indicators

**Update `apps/web/src/components/reader/reader-toolbar.tsx`:**
- Thin progress bar (2px) at top of reader showing `reading_progress`

**Update `apps/web/src/components/documents/document-list-item.tsx`:**
- Small progress indicator when `0 < reading_progress < 100`

**Success criteria:**
- [ ] Notebook tab shows document highlights ordered by position
- [ ] Click scrolls to highlight in content
- [ ] `/highlights` page lists all highlights with filters
- [ ] Reading progress bar in reader toolbar
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 24: Collection DB Queries + API + Routes

**Goal:** Create the complete data layer for collections. Independent from highlights — can be developed in parallel with Steps 21–23.

**Packages:** `packages/shared`, `packages/db`, `packages/api`, `apps/web`

#### 24a: Shared Types

**Update `packages/shared/src/types.ts`:**

```typescript
export interface CreateCollectionInput {
  id?: string;
  name: string;
  description?: string | null;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string | null;
}

export interface CollectionWithCount extends Collection {
  documentCount: number;
}

export interface CollectionWithDocuments extends Collection {
  documents: (DocumentWithTags & { sort_order: number; added_at: string })[];
}
```

#### 24b: Database — Collection Query Helpers

**New file: `packages/db/src/queries/collections.ts`**

```typescript
export async function createCollection(db: D1Database, input: CreateCollectionInput): Promise<Collection>;
export async function getCollection(db: D1Database, id: string): Promise<Collection | null>;
export async function listCollections(db: D1Database): Promise<CollectionWithCount[]>;
export async function updateCollection(db: D1Database, id: string, updates: UpdateCollectionInput): Promise<void>;
export async function deleteCollection(db: D1Database, id: string): Promise<void>;
export async function addDocumentToCollection(
  db: D1Database, collectionId: string, documentId: string, sortOrder?: number
): Promise<void>;
export async function removeDocumentFromCollection(
  db: D1Database, collectionId: string, documentId: string
): Promise<void>;
export async function getCollectionDocuments(
  db: D1Database, collectionId: string
): Promise<(DocumentWithTags & { sort_order: number; added_at: string })[]>;
export async function reorderCollectionDocuments(
  db: D1Database, collectionId: string, orderedDocumentIds: string[]
): Promise<void>;
export async function getCollectionsForDocument(db: D1Database, documentId: string): Promise<Collection[]>;
```

- `addDocumentToCollection()` uses `INSERT OR IGNORE`, defaults sort_order to MAX+1
- `reorderCollectionDocuments()` batch-updates sort_order
- `deleteCollection()` also deletes from collection_documents

#### 24c: API — Collection Business Logic

**New file: `packages/api/src/collections.ts`**

```typescript
export async function getCollections(db: D1Database): Promise<CollectionWithCount[]>;
export async function getCollectionDetail(db: D1Database, id: string): Promise<CollectionWithDocuments | null>;
export async function createCollection(db: D1Database, input: CreateCollectionInput): Promise<Collection>;
export async function patchCollection(db: D1Database, id: string, updates: UpdateCollectionInput): Promise<void>;
export async function removeCollection(db: D1Database, id: string): Promise<void>;
export async function addToCollection(db: D1Database, collectionId: string, documentId: string): Promise<void>;
export async function removeFromCollection(db: D1Database, collectionId: string, documentId: string): Promise<void>;
export async function reorderCollection(db: D1Database, collectionId: string, orderedDocumentIds: string[]): Promise<void>;
```

**Update `packages/api/src/index.ts`** — add `export * from "./collections.js";`

#### 24d: Web — API Routes + Hook

**New routes:**
- `apps/web/src/app/api/collections/route.ts` — GET, POST
- `apps/web/src/app/api/collections/[id]/route.ts` — GET (detail), PATCH, DELETE
- `apps/web/src/app/api/collections/[id]/documents/route.ts` — POST (add), DELETE (remove)
- `apps/web/src/app/api/collections/[id]/reorder/route.ts` — PUT

**New hook: `apps/web/src/hooks/use-collections.ts`**

#### 24e: Tests

- `packages/db/src/__tests__/collections.test.ts` — workerd CRUD + reorder tests
- `apps/web/src/__tests__/api/collections.test.ts` — route handler tests

**Success criteria:**
- [ ] Collection CRUD with UUID, timestamps
- [ ] Add/remove documents with auto sort_order
- [ ] Reorder batch-updates sort_order
- [ ] List returns document counts
- [ ] Cascading delete of collection_documents
- [ ] All API routes tested
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 25: Collection UI (Sidebar, Detail Page, Add-to-Collection)

**Goal:** Build the collection UI — sidebar section, detail page with drag-and-drop, add-to-collection from reader.

**Packages:** `apps/web`

#### 25a: Sidebar Collections Section

**Update `apps/web/src/components/layout/nav-sidebar.tsx`:**
- Add "Collections" collapsible section between Tags and Saved Views
- Each collection: FolderOpen icon, name, document count
- "New Collection" button

#### 25b: Create/Edit Collection Dialog

**New component: `apps/web/src/components/dialogs/collection-dialog.tsx`**

#### 25c: Collection Detail Page

**New route: `apps/web/src/app/(reader)/collections/[id]/page.tsx`**

- Drag-and-drop reordering via `@dnd-kit/core` + `@dnd-kit/sortable`
- Each row: drag handle, title, author, progress, remove button
- On reorder: PUT /api/collections/[id]/reorder

**New component: `apps/web/src/components/collections/sortable-document-row.tsx`**

#### 25d: Add-to-Collection from Reader

**Update `apps/web/src/components/reader/reader-toolbar.tsx`:**
- "Add to Collection" in overflow menu → dialog with collection checkboxes

**New component: `apps/web/src/components/dialogs/add-to-collection-dialog.tsx`**

#### 25e: Collection Info in Right Sidebar

**Update `apps/web/src/components/layout/right-sidebar.tsx`:**
- In Info tab: "Collections" section showing document's collections

**Success criteria:**
- [ ] Collections section in sidebar with counts
- [ ] Create/edit dialog works
- [ ] Detail page with drag-and-drop reordering
- [ ] Add-to-collection from reader toolbar
- [ ] Document's collections shown in right sidebar
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 26: Reading Preferences (DB, API, Settings UI, Reader Integration)

**Goal:** Customizable font family, font size, line height, content width — stored in D1, applied via CSS custom properties.

**Packages:** `packages/shared`, `packages/db`, `packages/api`, `apps/web`

#### 26a: Shared Types

**Update `packages/shared/src/types.ts`:**

```typescript
export interface UpdateUserPreferencesInput {
  theme?: string;
  font_family?: string | null;
  font_size?: number | null;
  line_height?: number | null;
  content_width?: number | null;
  shortcut_map_json?: string | null;
  view_mode_prefs_json?: string | null;
}
```

**Update `packages/shared/src/constants.ts`:**

```typescript
export const FONT_FAMILIES = [
  { value: "system", label: "System Default", css: "system-ui, sans-serif" },
  { value: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { value: "sans", label: "Sans-serif", css: "'Inter', system-ui, sans-serif" },
  { value: "mono", label: "Monospace", css: "'JetBrains Mono', 'Fira Code', monospace" },
  { value: "dyslexic", label: "OpenDyslexic", css: "'OpenDyslexic', sans-serif" },
] as const;

export const FONT_SIZE_RANGE = { min: 14, max: 24, default: 18, step: 1 };
export const LINE_HEIGHT_RANGE = { min: 1.2, max: 2.0, default: 1.6, step: 0.1 };
export const CONTENT_WIDTH_RANGE = { min: 500, max: 900, default: 680, step: 20 };
```

#### 26b: Database — User Preferences Queries

**New file: `packages/db/src/queries/user-preferences.ts`**

```typescript
export async function getUserPreferences(db: D1Database): Promise<UserPreferences | null>;
export async function upsertUserPreferences(
  db: D1Database, updates: UpdateUserPreferencesInput
): Promise<UserPreferences>;
```

Single-user app: uses fixed id `"default"`, `INSERT OR REPLACE` pattern.

#### 26c: API + Route + Hook

**New file: `packages/api/src/user-preferences.ts`**

```typescript
export async function getPreferences(db: D1Database): Promise<UserPreferences>;
export async function updatePreferences(
  db: D1Database, updates: UpdateUserPreferencesInput
): Promise<UserPreferences>;
```

**New route: `apps/web/src/app/api/preferences/route.ts`** — GET, PATCH
**New hook: `apps/web/src/hooks/use-preferences.ts`**

#### 26d: Settings UI

**Update `apps/web/src/app/settings/page.tsx`:**
- Add "Reading" section: font family select, font size slider, line height slider, content width slider
- Live preview showing current preferences

#### 26e: Reader Integration

**Update `apps/web/src/components/reader/reader-content.tsx`:**

Apply preferences as inline styles on `<article>`:
```typescript
const readerStyles = {
  maxWidth: `${prefs.content_width ?? 680}px`,
  fontFamily: fontFamilyCss,
  fontSize: `${prefs.font_size ?? 18}px`,
  lineHeight: `${prefs.line_height ?? 1.6}`,
};
```

#### 26f: Quick Preferences Popover

**New component: `apps/web/src/components/reader/reader-preferences-popover.tsx`**
- Accessible from reader toolbar via `Aa` button
- Font family, size +/-, line height +/-, width +/-, reset

#### 26g: Tests

- `packages/db/src/__tests__/user-preferences.test.ts` — workerd upsert/get tests
- `apps/web/src/__tests__/api/preferences.test.ts` — GET/PATCH route tests

**Success criteria:**
- [ ] Get/upsert user preferences in D1
- [ ] Settings page controls for font, size, line height, width
- [ ] Changes persist and apply immediately to reader
- [ ] Quick popover in reader toolbar
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 27: Data Export (JSON, Markdown, Highlights, Copy-as-Markdown)

**Goal:** Full JSON export, Markdown export (single doc with YAML frontmatter + highlights, bulk ZIP, highlights-only), copy-as-markdown.

**Packages:** `packages/parser`, `packages/api`, `apps/web`

#### 27a: Parser — Markdown Export Formatter

**New file: `packages/parser/src/export.ts`**

```typescript
export interface MarkdownExportOptions {
  includeHighlights?: boolean;
  includeNotes?: boolean;
  highlightFormat?: "inline" | "appendix";  // inline = ==text==, appendix = list at end
}

export interface DocumentExportData {
  document: Document;
  tags: Tag[];
  highlights: HighlightWithTags[];
}

/**
 * Format a document as Markdown with YAML frontmatter.
 * Frontmatter: title, author, url, tags, saved_date, published_date, type, word_count, reading_progress.
 *
 * Highlight formats:
 *   - "inline": wraps highlighted text in ==highlight== markers within the markdown
 *   - "appendix": appends a ## Highlights section at end with blockquotes + notes
 */
export function formatDocumentAsMarkdown(
  data: DocumentExportData, options?: MarkdownExportOptions
): string;

/**
 * Format highlights only (no document content) as Markdown.
 * Groups by document, each highlight as a blockquote with note and tags.
 */
export function formatHighlightsAsMarkdown(highlights: HighlightWithDocument[]): string;

/** Generate YAML frontmatter string from document metadata. */
export function generateFrontmatter(doc: Document, tags: Tag[]): string;
```

YAML frontmatter example:
```yaml
---
title: "How to Build a Read-It-Later App"
author: "John Doe"
url: "https://example.com/article"
tags:
  - reading
  - software
saved_date: "2026-02-15"
published_date: "2026-02-10"
type: article
word_count: 1500
reading_progress: 75
---
```

Highlight appendix format:
```markdown
## Highlights

> The key insight is that reading should be an active process, not passive consumption.

**Note:** This resonates with Adler's levels of reading.
**Color:** Yellow | **Tags:** #reading, #methodology

---

> Building in public means sharing your progress regularly.

**Color:** Green
```

**New dependency:** `js-yaml` in `packages/parser`

#### 27b: API — Export Business Logic

**New file: `packages/api/src/export.ts`**

```typescript
/** Full JSON export of all user data. */
export async function exportAllJson(db: D1Database): Promise<object>;

/** Export a single document as Markdown with frontmatter and highlights. */
export async function exportDocumentMarkdown(
  db: D1Database, documentId: string,
  options?: { includeHighlights?: boolean; highlightFormat?: "inline" | "appendix" }
): Promise<string>;

/** Export multiple documents as Markdown. Returns array for ZIP packaging. */
export async function exportBulkMarkdown(
  db: D1Database,
  options?: { tagId?: string; location?: DocumentLocation; includeHighlights?: boolean }
): Promise<{ filename: string; content: string }[]>;

/** Export all highlights as Markdown, grouped by document. */
export async function exportHighlightsMarkdown(
  db: D1Database,
  options?: { tagId?: string; documentId?: string }
): Promise<string>;
```

**Update `packages/api/src/index.ts`** — add `export * from "./export.js";`

#### 27c: Web — Export Routes

- `apps/web/src/app/api/export/json/route.ts` — GET (full JSON download)
- `apps/web/src/app/api/export/markdown/route.ts` — GET (bulk ZIP via `jszip`, or highlights-only)
- `apps/web/src/app/api/documents/[id]/export/route.ts` — GET (single doc Markdown)

The bulk Markdown route uses `jszip` to create a ZIP archive:
```typescript
const files = await exportBulkMarkdown(db, { includeHighlights: true });
const zip = new JSZip();
for (const file of files) {
  zip.file(file.filename, file.content);
}
const buffer = await zip.generateAsync({ type: "arraybuffer" });
return new Response(buffer, {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="focus-reader-export.zip"',
  },
});
```

#### 27d: Copy-as-Markdown in Reader

**Update `apps/web/src/components/reader/reader-toolbar.tsx`:**
- "Copy as Markdown" in overflow menu → copies frontmatter + content to clipboard

#### 27e: Export Settings Page

**New page: `apps/web/src/app/settings/export/page.tsx`**
- Export All (JSON), Export All Documents (Markdown ZIP), Export Highlights (Markdown)
- Optional filters by tag/location

**Update `apps/web/src/app/settings/layout.tsx`:** Add "Export" nav entry

#### 27f: Tests

- `packages/parser/src/__tests__/export.test.ts` — frontmatter, markdown formatting, highlights
- `apps/web/src/__tests__/api/export.test.ts` — route handler tests

**Success criteria:**
- [ ] YAML frontmatter generation correct
- [ ] Inline and appendix highlight formats work
- [ ] JSON export includes all data
- [ ] Single doc Markdown includes frontmatter + content + highlights
- [ ] Bulk Markdown creates valid ZIP
- [ ] Copy-as-Markdown works in reader
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes

---

### Step 28: Phase 3 Polish + Test Coverage

**Goal:** Edge cases, UX polish, test coverage, accessibility, and performance.

**Packages:** All

#### 28a: Highlight Edge Cases
- Overlapping highlights, cross-element spans
- Re-anchoring failures (show warning in notebook, still display in list)
- Highlights in markdown mode

#### 28b: Collection Edge Cases
- Document deletion → remove from collections
- Empty collection state
- Name validation (100 char max)

#### 28c: Preferences Edge Cases
- Font loading for non-system fonts (OpenDyslexic `@font-face`)
- Preferences in focus mode and markdown mode
- Context-based caching (avoid SWR refetch on every page)

#### 28d: Command Palette Updates
- Add: "Create Collection", "Export Data", "Go to Highlights"

#### 28e: Test Coverage
All new query helpers, API logic, and route handlers fully tested.

#### 28f: Performance + Accessibility
- Batch DOM reads/writes for highlight rendering
- Keyboard navigation for popovers
- Keyboard alternative for drag-and-drop (move up/down buttons)
- ARIA labels on all new controls

**Success criteria:**
- [ ] All edge cases handled
- [ ] Command palette includes Phase 3 commands
- [ ] Full test coverage for new features
- [ ] Accessible keyboard navigation
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes with zero failures

---

## 5. Step Dependency Graph

```
Step 21 (Highlight DB + API)
   │
   ├──→ Step 22 (Highlight UI) ──→ Step 23 (Notebook + highlights page)
   │                                           │
   │                                           ├──→ Step 27 (Export)
   │                                           │
   Step 24 (Collection DB + API) ──→ Step 25 (Collection UI) ──┤
   │                                                            │
   Step 26 (Reading preferences) ──────────────────────────────┤
                                                                │
                                                                └──→ Step 28 (Polish + tests)
```

### Parallelization

| Track | Steps | Description |
|---|---|---|
| **A** | 21 → 22 → 23 | Highlights: foundation → reader UI → notebook & global |
| **B** | 24 → 25 | Collections: foundation → UI |
| **C** | 26 | Reading preferences (fully independent) |

Step 27 (Export) depends on 21+23. Step 28 (Polish) runs last.

### Recommended Serial Order

1. Step 21 — Highlight DB + API
2. Step 22 — Highlight UI in reader
3. Step 24 — Collection DB + API
4. Step 23 — Notebook + highlights management
5. Step 25 — Collection UI
6. Step 26 — Reading preferences
7. Step 27 — Data export
8. Step 28 — Phase 3 polish + tests

---

## 6. Files Summary

### Modified
| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add highlight, collection, preferences input/update types; PositionSelector; HighlightWithTags; CollectionWithCount/WithDocuments |
| `packages/shared/src/constants.ts` | Add HIGHLIGHT_COLORS, FONT_FAMILIES, size/height/width ranges |
| `packages/db/src/index.ts` | 3 new exports (highlights, collections, user-preferences) |
| `packages/db/src/migration-sql.ts` | Embed 0003 migration |
| `packages/api/src/index.ts` | 4 new exports (highlights, collections, user-preferences, export) |
| `packages/parser/src/index.ts` | 1 new export (export) |
| `apps/web/src/components/reader/reader-content.tsx` | Highlight rendering, preferences CSS |
| `apps/web/src/components/layout/right-sidebar.tsx` | Enable Notebook tab, collection info |
| `apps/web/src/components/layout/nav-sidebar.tsx` | Highlights link, Collections section |
| `apps/web/src/components/reader/reader-toolbar.tsx` | Progress bar, add-to-collection, copy-as-markdown, Aa preferences |
| `apps/web/src/components/documents/document-list-item.tsx` | Reading progress indicator |
| `apps/web/src/components/layout/app-shell.tsx` | `h` highlight shortcut |
| `apps/web/src/app/settings/page.tsx` | Reading preferences section |
| `apps/web/src/app/settings/layout.tsx` | Export nav entry |
| `apps/web/src/app/globals.css` | highlight-pulse animation |
| `apps/web/src/components/dialogs/command-palette.tsx` | Phase 3 commands |

### Created
| File | Purpose |
|------|---------|
| `packages/db/migrations/0003_highlight_collection_indexes.sql` | Performance indexes |
| `packages/db/src/queries/highlights.ts` | Highlight CRUD + tags |
| `packages/db/src/queries/collections.ts` | Collection CRUD + document management |
| `packages/db/src/queries/user-preferences.ts` | Get/upsert preferences |
| `packages/api/src/highlights.ts` | Highlight business logic |
| `packages/api/src/collections.ts` | Collection business logic |
| `packages/api/src/user-preferences.ts` | Preferences business logic |
| `packages/api/src/export.ts` | Export business logic |
| `packages/parser/src/export.ts` | Markdown/YAML formatter |
| `apps/web/src/app/api/documents/[id]/highlights/route.ts` | Highlight routes per document |
| `apps/web/src/app/api/highlights/route.ts` | Global highlights list |
| `apps/web/src/app/api/highlights/[id]/route.ts` | Highlight CRUD |
| `apps/web/src/app/api/highlights/[id]/tags/route.ts` | Highlight tag operations |
| `apps/web/src/app/api/collections/route.ts` | Collection list/create |
| `apps/web/src/app/api/collections/[id]/route.ts` | Collection CRUD |
| `apps/web/src/app/api/collections/[id]/documents/route.ts` | Add/remove documents |
| `apps/web/src/app/api/collections/[id]/reorder/route.ts` | Reorder documents |
| `apps/web/src/app/api/preferences/route.ts` | Preferences GET/PATCH |
| `apps/web/src/app/api/export/json/route.ts` | JSON export |
| `apps/web/src/app/api/export/markdown/route.ts` | Markdown/ZIP export |
| `apps/web/src/app/api/documents/[id]/export/route.ts` | Single doc export |
| `apps/web/src/app/(reader)/highlights/page.tsx` | Global highlights page |
| `apps/web/src/app/(reader)/collections/[id]/page.tsx` | Collection detail page |
| `apps/web/src/app/settings/export/page.tsx` | Export settings page |
| `apps/web/src/hooks/use-highlights.ts` | Highlight SWR hooks |
| `apps/web/src/hooks/use-collections.ts` | Collection SWR hooks |
| `apps/web/src/hooks/use-preferences.ts` | Preferences hook |
| `apps/web/src/components/reader/highlight-popover.tsx` | Text selection popover |
| `apps/web/src/components/reader/highlight-renderer.tsx` | Inline highlight rendering |
| `apps/web/src/components/reader/highlight-detail-popover.tsx` | Edit/delete highlight |
| `apps/web/src/components/reader/notebook-highlight-card.tsx` | Notebook card |
| `apps/web/src/components/reader/reader-preferences-popover.tsx` | Quick Aa popover |
| `apps/web/src/components/highlights/highlight-list.tsx` | Global highlight list |
| `apps/web/src/components/collections/sortable-document-row.tsx` | Drag-and-drop row |
| `apps/web/src/components/dialogs/collection-dialog.tsx` | Create/edit collection |
| `apps/web/src/components/dialogs/add-to-collection-dialog.tsx` | Add doc to collection |

---

## 7. Conventions and Constraints

Same as Phase 2:
- **Vitest** pinned to `~3.2.0`
- **ESM imports** with `.js` extensions
- **D1 foreign keys NOT enforced** — cascade at application level
- **Query helpers** take `db: D1Database` as first param
- **All types** in `packages/shared/src/types.ts`
- **Workerd tests** — no filesystem reads, embed fixtures as strings
- **Run `pnpm build && pnpm typecheck && pnpm test` before committing**

---

## 8. Phase 3 Exit Criteria

- [ ] Text selection creates highlights with configurable colors
- [ ] Highlights persist and re-anchor on document reopen
- [ ] Highlights support notes and tags
- [ ] Notebook tab shows document highlights, click scrolls to highlight
- [ ] `/highlights` page lists all highlights with color/tag filters
- [ ] Collections CRUD with sidebar section and document counts
- [ ] Drag-and-drop reorder within collections
- [ ] Add-to-collection from reader toolbar
- [ ] Reading preferences (font, size, line height, width) saved and applied
- [ ] Quick preferences popover in reader toolbar
- [ ] Full JSON export includes all data
- [ ] Single doc Markdown export with YAML frontmatter + highlights
- [ ] Bulk Markdown export as ZIP
- [ ] Highlights-only Markdown export
- [ ] Copy-as-Markdown in reader
- [ ] Reading progress bar in reader + document list
- [ ] All routes enforce authentication
- [ ] Full test coverage for new features
- [ ] `pnpm build && pnpm typecheck && pnpm test` passes with zero failures
