# Focus Reader — Phase 1 UI Specification

**Version:** 1.0
**Date:** February 14, 2026
**Status:** Draft
**Reference:** Readwise Reader UI as visual benchmark

---

## 1. Design System & Technology

### 1.1 Stack

- **Framework:** Next.js 14+ (App Router) on Cloudflare Pages
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix primitives + Tailwind)
- **Icons:** Lucide React
- **Data fetching:** SWR for client-side cache + mutation
- **State:** URL search params for view state (location, selected document), React context for ephemeral UI state (sidebar collapsed, focus mode)

### 1.2 Theme (Phase 1: Light Only)

| Token                  | Value              | Usage                                   |
|------------------------|--------------------|-----------------------------------------|
| `--background`         | `hsl(0 0% 100%)`   | Page background                         |
| `--foreground`         | `hsl(222 47% 11%)` | Primary text (slate-900)                |
| `--muted`              | `hsl(210 40% 96%)` | Subtle backgrounds (slate-100)          |
| `--muted-foreground`   | `hsl(215 16% 47%)` | Secondary text (slate-500)              |
| `--border`             | `hsl(214 32% 91%)` | Borders and dividers (slate-200)        |
| `--primary`            | `hsl(221 83% 53%)` | Active states, links, accent (blue-600) |
| `--primary-foreground` | `hsl(0 0% 100%)`   | Text on primary                         |
| `--destructive`        | `hsl(0 84% 60%)`   | Delete actions (red-500)                |
| `--accent`             | `hsl(210 40% 96%)` | Hover backgrounds                       |
| `--ring`               | `hsl(221 83% 53%)` | Focus rings                             |

### 1.3 Typography

| Element               | Font         | Size              | Weight                        | Color                          |
|-----------------------|--------------|-------------------|-------------------------------|--------------------------------|
| Sidebar nav item      | System sans  | 14px (`text-sm`)  | 500 (`font-medium`)           | `foreground`                   |
| Document list title   | System sans  | 14px (`text-sm`)  | 600 (unread) / 400 (read)     | `foreground`                   |
| Document list meta    | System sans  | 12px (`text-xs`)  | 400                           | `muted-foreground`             |
| Document list excerpt | System sans  | 13px              | 400                           | `muted-foreground`             |
| Reading pane title    | System serif | 28px (`text-2xl`) | 700                           | `foreground`                   |
| Reading pane body     | System serif | 17px              | 400                           | `foreground`, line-height 1.75 |
| Reading pane meta     | System sans  | 13px              | 400                           | `muted-foreground`             |
| Info panel heading    | System sans  | 11px (`text-xs`)  | 600, uppercase, tracking-wide | `muted-foreground`             |
| Info panel value      | System sans  | 13px              | 400                           | `foreground`                   |

### 1.4 Spacing & Layout Constants

| Constant               | Value                                        |
|------------------------|----------------------------------------------|
| Nav sidebar width      | 240px (collapsed: 0px, mobile: full overlay) |
| Document list width    | `flex-1`, fills remaining space              |
| TOC aside width        | ~296px (reading view, collapsible)           |
| Right sidebar width    | ~296px (collapsible, resizable handle)       |
| Document row height    | ~72px (auto, min-height)                     |
| Content max-width      | 680px (centered in content area)             |
| Reading nav bar height | ~64px                                        |
| Section padding        | 16px (`p-4`)                                 |
| Gap between panes      | 0px (separated by `border-r`)                |

---

## 2. Layout Architecture

### 2.1 Two-Mode Layout with Persistent Right Sidebar

The app uses a **two-mode layout** identical to [Readwise Reader](https://read.readwise.io). Instead of a fixed three-pane shell, the layout transitions between two distinct modes while a collapsible **right sidebar** persists across both.

#### Mode 1: Library View (browsing)

When the user is browsing their document list (e.g. `/inbox`, `/later`, `/archive`):

```
┌──────────┬──────────────────────────────┬──────────────────┐
│ Nav      │   Document List              │  Right Sidebar   │
│ Sidebar  │                              │  (Info panel)    │
│ 240px    │   Header: Library ▾          │  ~296px          │
│          │   Tabs: Inbox Later Archive  │                  │
│ Home     │   Sort: Date moved ▾         │  ┌──────────────┐│
│ Library  │   ────────────────────       │  │Info Nb Chat  ││
│  Articles│   Doc row                    │  ├──────────────┤│
│  Books   │   Doc row (selected)         │  │ Title        ││
│  Emails  │   Doc row                    │  │ domain.com   ││
│  PDFs    │   Doc row                    │  │              ││
│  Tweets  │   ...                        │  │ Author       ││
│  Videos  │                              │  │ Tags         ││
│  Podcasts│                              │  │ Metadata     ││
│  Tags    │                              │  │              ││
│ Feed     │                              │  └──────────────┘│
│ Pinned ▾ │                              │                  │
│  Shortlst│                              │                  │
│ Trash    │                              │                  │
│ Search   │                              │                  │
│ Prefs    │                              │                  │
└──────────┴──────────────────────────────┴──────────────────┘
```

The nav sidebar is collapsible via a toggle button and keyboard shortcut`[`. The document list fills the remaining space between the sidebar and the right panel. Selecting a document in the list updates the right sidebar to show that document's metadata.

#### Mode 2: Reading View (document open)

When the user clicks into a document (navigates to `/inbox/read/[id]`), the nav sidebar and document list **disappear** and are replaced by the reading experience:

```
┌──────────────┬──────────────────────────────┬──────────────────┐
│ TOC (aside)  │   Article Content            │  Right Sidebar   │
│ ~296px       │                              │  (Info/Nb/Chat)  │
│              │                              │  ~296px          │
│ ┌──────────┐ │   DOMAIN.COM                 │                  │
│ │← ∧ ∨     │ │   Title of the Document      │  ┌──────────────┐│
│ │Nav bar   │ │   Author · 5 min · Jan 8th   │  │Info Nb Chat  ││
│ ├──────────┤ │                              │  ├──────────────┤│
│ │ §1       │ │   [Article content rendered  │  │ Title        ││
│ │ §2       │ │    here with max-width       │  │ domain.com   ││
│ │ §3       │ │    centered]                 │  │              ││
│ │ §4       │ │                              │  │ Author       ││
│ │ §5       │ │                              │  │ Tags         ││
│ │ ...      │ │                              │  │ Metadata     ││
│ │          │ │                              │  │              ││
│ └──────────┘ │                              │  └──────────────┘│
└──────────────┴──────────────────────────────┴──────────────────┘
```

The TOC panel contains:
- **Nav bar** (top): Back-to-list button (`←`), previous/next document (`∧`/`∨`), and a left-panel toggle
- **Table of Contents**: Auto-generated heading links from the document

The content area fills the remaining space. The right sidebar persists with the same Info/Notebook/Chat tabs.

**Implementation:** `app/(reader)/layout.tsx`

```
<div className="flex h-screen overflow-hidden">
  {/* Library View */}
  {!isReadingDocument && (
    <>
      <Sidebar />                        {/* fixed 240px, collapsible */}
      <DocumentList />                   {/* flex-1, fills remaining */}
    </>
  )}

  {/* Reading View */}
  {isReadingDocument && (
    <>
      <ReadingAside />                   {/* fixed ~296px: nav bar + TOC */}
      <ArticleContent />                 {/* flex-1, fills remaining */}
    </>
  )}

  {/* Persistent across both modes */}
  <RightSidebar />                       {/* fixed ~296px, collapsible */}
</div>
```

### 2.2 Responsive Breakpoints

| Breakpoint          | Library View                 | Reading View                           |
|---------------------|------------------------------|----------------------------------------|
| Desktop `≥1024px`   | Nav + List + Right Panel     | TOC + Content + Right Panel            |
| Tablet `768–1023px` | Nav hidden, List + Right     | TOC hidden, Content + Right Panel      |
| Mobile `<768px`     | Nav as slide-over, List only | Content full-width, panels as overlays |

On mobile, selecting a document navigates to the reading view. A back button returns to the list.

### 2.3 Focus Mode

Activated by `f` key or toolbar button. In reading view, hides the TOC panel. Content expands to full width. Right sidebar remains toggleable. ESC exits focus mode.

---

## 3. Sidebar

**Component:** `components/layout/sidebar.tsx`
**Visual reference:** Readwise left sidebar

### 3.1 Structure

```
┌─────────────────────┐
│ ☐ ⊕   Focus Reader  │  ← Brand + collapse + add buttons
├─────────────────────┤
│ ◉ Inbox         (12)│  ← System views with unread counts
│ ○ Later             │
│ ○ Archive           │
│ ○ All               │
│ ★ Starred           │
├─────────────────────┤
│ ▾ Subscriptions     │  ← Collapsible section
│   Morning Brew  (3) │
│   Substack XYZ  (1) │
│   ...               │
├─────────────────────┤
│ ▾ Tags              │  ← Collapsible section
│   ● ai-coding   (5) │
│   ● blogging    (3) │
│   ...               │
├─────────────────────┤
│ ⌕ Search            │  ← Disabled in Phase 1 (placeholder)
│ ⚙ Settings          │
└─────────────────────┘
```

### 3.2 Component Details

#### Brand Bar (top)
- **Left:** App name "Focus Reader" in `font-semibold text-sm`
- **Right:** Two icon buttons (`size-8`):
  - Collapse sidebar toggle (`PanelLeftClose` / `PanelLeftOpen` icon)
  - Add content button (`Plus` icon) — opens add content dropdown

#### Navigation Items
Each nav item is a `<Link>` styled as a row:
- Layout: `flex items-center gap-3 px-3 py-2 rounded-md text-sm`
- Icon: Lucide icon, `size-4`, `text-muted-foreground`
- Label: `font-medium`
- Count badge (optional): `ml-auto text-xs text-muted-foreground`
- **Active state:** `bg-accent text-primary font-semibold` (light blue bg like Readwise)
- **Hover state:** `hover:bg-accent`

| View    | Icon      | Path       | Badge        |
|---------|-----------|------------|--------------|
| Inbox   | `Inbox`   | `/inbox`   | Unread count |
| Later   | `Clock`   | `/later`   | —            |
| Archive | `Archive` | `/archive` | —            |
| All     | `Library` | `/all`     | —            |
| Starred | `Star`    | `/starred` | —            |

#### Subscriptions Section
- **Header:** `flex items-center justify-between px-3 py-1.5` with `ChevronDown`/`ChevronRight` toggle
  - Label: "Subscriptions" in `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
  - "..." button on hover: opens context menu (manage subscriptions link)
- **Items:** Same as nav items but with:
  - Icon: First letter avatar circle (`size-5 rounded-full bg-primary/10 text-primary text-xs font-medium`) or favicon if available
  - Label: Subscription `display_name`, truncated with `truncate`
  - Badge: Unread count for that subscription
  - Click navigates to `/subscriptions/[id]`
- **Collapsed:** Only the section header is visible

#### Tags Section
- Same collapsible pattern as Subscriptions
- **Items:**
  - Icon: Colored circle dot (`size-2 rounded-full`) using the tag's `color` field
  - Label: Tag `name`
  - Badge: Document count
  - Click navigates to `/tags/[id]`

#### Footer
- **Search:** `Search` icon + "Search" label. Disabled for Phase 1, show as `opacity-50 cursor-not-allowed` with tooltip "Coming in Phase 2"
- **Settings:** `Settings` icon + "Settings" label. Navigates to `/settings`

### 3.3 Mobile Sidebar
- Triggered by hamburger button (`Menu` icon) in mobile top bar
- Slides in from left as an overlay using shadcn `Sheet` component (`side="left"`)
- Semi-transparent backdrop `bg-black/50`
- Same content as desktop sidebar
- Closes on navigation or backdrop click

---

## 4. Document List

**Component:** `components/layout/document-list.tsx`
**Visual reference:** Readwise center pane

### 4.1 Structure

```
┌────────────────────────────────┐
│ ≡ Library ▾   INBOX LATER ARCH │  ← Header with view name + triage tabs
│                    Date saved ▾│  ← Sort dropdown
├────────────────────────────────┤
│ ● [img] Title of document      │
│         excerpt text here...   │
│         source · author · 5min │
├────────────────────────────────┤
│   [img] Another document       │
│         excerpt text here...   │
│         source · author · 3min │
├────────────────────────────────┤
│   ...                          │
│                                │
│                     Count: 123 │  ← Footer count badge
└────────────────────────────────┘
```

### 4.2 Header

**Layout:** `flex flex-col border-b`

#### Top Row
- **Left:** View icon + view name as a dropdown button (shadcn `Button` variant `ghost`)
  - In Library view: shows "Library" with `Library` icon
  - In Emails view: shows "Emails" with `Mail` icon
  - Dropdown lists all content type filters (All, Articles, Emails, Bookmarks)
- **Triage tabs:** `INBOX`, `LATER`, `ARCHIVE` as inline tab buttons
  - Layout: `flex gap-1`
  - Each tab: `text-xs font-semibold uppercase tracking-wider px-3 py-1.5`
  - Active tab: `text-primary border-b-2 border-primary`
  - Inactive tab: `text-muted-foreground hover:text-foreground`
  - Tabs filter the `location` field of the document list query

#### Sort Row
- **Right-aligned:** Sort dropdown (`Button` variant `ghost` + `ChevronDown`)
- Sort options: "Date saved" (default, `saved_at DESC`), "Date published" (`published_at DESC`), "Title A–Z" (`title ASC`), "Reading time" (`reading_time_minutes ASC`)

### 4.3 Document Row

**Component:** `components/documents/document-row.tsx`

Each row represents a `Document` and is a clickable element.

**Layout:**
```
<div className="flex gap-3 px-4 py-3 border-b cursor-pointer hover:bg-accent/50
                data-[selected=true]:bg-accent">
  {/* Unread dot */}
  <div className="w-2 flex-shrink-0 pt-2">
    {!isRead && <div className="size-2 rounded-full bg-primary" />}
  </div>

  {/* Thumbnail */}
  <div className="size-14 rounded flex-shrink-0 bg-muted overflow-hidden">
    {coverImage ? <img /> : <TypeIcon />}
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <h3 className={cn("text-sm truncate", !isRead && "font-semibold")}>
      {title}
    </h3>
    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
      {excerpt}
    </p>
    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
      <SourceIcon /> <span>{siteName || source}</span>
      <span>·</span> <span>{author}</span>
      <span>·</span> <span>{readingTime}min</span>
    </div>
  </div>

  {/* Right meta */}
  <div className="flex flex-col items-end gap-1 flex-shrink-0">
    <span className="text-xs text-muted-foreground">{relativeDate}</span>
    {isStarred && <Star className="size-3 text-amber-400 fill-amber-400" />}
  </div>
</div>
```

**States:**
- **Unread:** Blue dot on the left, title in `font-semibold`
- **Read:** No dot, title in `font-normal`
- **Selected:** `bg-accent` (light blue background)
- **Hover:** `bg-accent/50`
- **Starred:** Small filled star icon next to the date

**Thumbnail fallback by document type:**
| Type | Fallback |
|---|---|
| `email` | `Mail` icon on `bg-muted` |
| `article` | `FileText` icon on `bg-muted` |
| `bookmark` | `Bookmark` icon on `bg-muted` |
| `rss` | `Rss` icon on `bg-muted` |

**Reading progress indicator:** A thin colored bar at the bottom of the row (like Readwise's partial-read green bar):
- `<div className="h-0.5 bg-primary/40" style={{ width: `${progress}%` }} />`
- Only shown when `reading_progress > 0 && reading_progress < 100`

### 4.4 Pagination

- Initial load: 50 documents (from `DEFAULT_PAGE_SIZE`)
- As user scrolls near the bottom, trigger "load more" (infinite scroll using `IntersectionObserver`)
- Show `Loader2` spinner during loading
- **Count badge:** Bottom-right corner: `text-xs text-muted-foreground` showing "Count: {total}"

### 4.5 Empty States

| View              | Illustration         | Message                   | Action                                                |
|-------------------|----------------------|---------------------------|-------------------------------------------------------|
| Inbox (empty)     | `Inbox` icon large   | "Your inbox is empty"     | "Add an article or subscribe to a newsletter"         |
| Later (empty)     | `Clock` icon large   | "Nothing saved for later" | "Move documents here when you want to read them soon" |
| Archive (empty)   | `Archive` icon large | "Archive is empty"        | "Documents you've finished reading will appear here"  |
| Starred (empty)   | `Star` icon large    | "No starred documents"    | "Star important documents to find them quickly"       |
| Search no results | `SearchX` icon large | "No documents found"      | "Try different filters"                               |

Empty state layout: centered vertically and horizontally, icon `size-12 text-muted-foreground/30`, message in `text-sm text-muted-foreground`, action text in `text-xs text-muted-foreground`.

---

## 5. Reading Pane

**Component:** `components/layout/reading-pane.tsx`
**Visual reference:** Readwise reading view

### 5.1 Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← ∧ ∨ □   Aa 🔲           ☐tag ⏰snooze 📥archive ... │ Info Nb │  ← Toolbar
├─────┬──────────────────────────────────────────┬────────────────────┤
│ TOC │                                          │ Info Panel         │
│     │     SOURCE.COM                           │                    │
│ §1  │     Title of the Document                │ Title              │
│ §2  │     Author · 5 min · Feb 13th            │ source.com         │
│ §3  │                                          │                    │
│ §4  │     [Article content rendered here]      │ Author Name        │
│     │     with max-width 680px centered        │ author@email       │
│     │                                          │                    │
│     │                                          │ METADATA           │
│     │                                          │ Type: Article      │
│     │                                          │ Domain: source.com │
│     │                                          │ Published: Feb 12  │
│     │                                          │ Length: 13min      │
│     │                                          │ Saved: 16h ago     │
│     │                                          │ Progress: 0%       │
└─────┴──────────────────────────────────────────┴────────────────────┘
```

### 5.2 Toolbar

**Layout:** `flex items-center h-12 px-3 border-b bg-background`

#### Left Group
- **Back button:** `ArrowLeft` icon button → returns to list (deselects document). Only visible on mobile/tablet.
- **Prev/Next:** `ChevronUp` / `ChevronDown` icon buttons → navigate to previous/next document in current list. Disabled at boundaries. Map to `↑`/`↓` keys.
- **Split view toggle:** `PanelLeft` icon button → toggles the Table of Contents panel
- **Typography button:** `Type` icon labeled "Aa" — reserved for Phase 2 (font/size controls). Show as disabled.

#### Center (spacer)
Empty `flex-1` spacer.

#### Right Group
Icon buttons in a row with `gap-1`:

| Icon               | Action       | Shortcut  | Behavior                            |
|--------------------|--------------|-----------|-------------------------------------|
| `Tag`              | Add tag      | `t`       | Opens tag picker dropdown           |
| `Star`             | Star/unstar  | `f`       | Toggle. Filled yellow when starred. |
| `BookOpen`/`BookX` | Read/unread  | `Space`   | Toggle mark as read/unread          |
| `Archive`          | Archive      | `e`       | Move to archive location            |
| `MoreHorizontal`   | More actions | —         | Opens overflow menu                 |

#### Overflow Menu (shadcn `DropdownMenu`)
- Move to Inbox (`Shift+E`)
- Move to Later (`l`)
- Move to Archive (`e`)
- Separator
- Toggle HTML/Markdown view (`Shift+H`)
- Open original URL (`o`) — opens `document.url` in new tab
- Copy document URL (`Shift+C`)
- Separator
- Delete document (`d`) — destructive, red text

### 5.3 Table of Contents (Left Sub-Panel)

**Component:** `components/documents/table-of-contents.tsx`

- Width: 180px, hidden by default, toggleable via toolbar button
- Shows auto-generated headings from the document HTML (`h1`–`h3`)
- Each entry: `text-xs text-muted-foreground hover:text-primary cursor-pointer`
- Active heading (based on scroll position): `text-primary font-medium`
- Indentation: `h1` → `pl-0`, `h2` → `pl-3`, `h3` → `pl-6`
- Scroll sync: highlights the current heading as user scrolls the content area

### 5.4 Content Area

**Component:** `components/documents/document-reader.tsx`

Centered content column with `max-w-[680px] mx-auto px-6 py-8`.

#### Document Header
```
<div className="mb-8">
  {/* Source */}
  <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-3">
    <SourceFavicon className="size-4" />
    <span>{siteName || domain}</span>
  </div>

  {/* Title */}
  <h1 className="text-2xl font-bold font-serif leading-tight mb-3">
    {title}
  </h1>

  {/* Meta row */}
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <span>{author}</span>
    <span>·</span>
    <span>{readingTime} mins</span>
    <span>·</span>
    <span>{formatDate(publishedAt)}</span>
  </div>
</div>
```

#### Content Body (HTML mode — default)
- Render sanitized HTML inside a `prose` container using Tailwind Typography plugin:
  ```
  <article
    className="prose prose-slate max-w-none
               prose-headings:font-serif prose-headings:font-bold
               prose-p:leading-relaxed
               prose-a:text-primary prose-a:no-underline hover:prose-a:underline
               prose-img:rounded-lg prose-img:mx-auto
               prose-blockquote:border-l-primary prose-blockquote:not-italic"
    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
  />
  ```
- Images: loaded lazily, responsive `max-w-full`, rounded corners
- Links: open in new tab (`target="_blank" rel="noopener"`)

#### Content Body (Markdown mode)
- Toggle via toolbar overflow menu or `Shift+H`
- Render `markdown_content` using the same `prose` styles
- Show a small badge/indicator in the toolbar when in Markdown mode

#### Auto-Mark as Read
- When a document is opened and visible for 1.5 seconds continuously, automatically call `PATCH /api/documents/[id]` with `{ is_read: 1 }`
- Implementation: `useEffect` with `setTimeout(1500)`, cleared on unmount or document change
- Manual toggle (`Space` key) always overrides

### 5.5 Info Panel (Right Sub-Panel)

**Component:** `components/documents/info-panel.tsx`
**Visual reference:** Readwise right "Info" panel

Width: 280px, collapsible via icon button in the toolbar area.

#### Panel Tabs
Using shadcn `Tabs` component:
- **Info** (active in Phase 1)
- **Notebook** — disabled, Phase 2+ (highlights/notes)

#### Info Tab Content

``` tsx
<div className="p-4 space-y-6 overflow-y-auto">
  {/* Title */}
  <h2 className="text-sm font-semibold leading-snug">{title}</h2>
  <p className="text-xs text-muted-foreground">{domain}</p>

  {/* Author */}
  <div className="flex items-center gap-3">
    <Avatar className="size-8">
      <AvatarFallback>{authorInitial}</AvatarFallback>
    </Avatar>
    <div>
      <p className="text-sm font-medium">{author}</p>
      <p className="text-xs text-muted-foreground">{authorEmail || siteName}</p>
    </div>
  </div>

  {/* Subscription badge (for email type) */}
  {document.type === 'email' && (
    <Button variant="outline" size="sm" className="w-full">
      <Rss className="size-3 mr-2" /> Subscribed
    </Button>
  )}

  {/* Tags */}
  <div>
    <SectionHeading>TAGS</SectionHeading>
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.map(tag => <TagBadge key={tag.id} tag={tag} removable />)}
      <Button variant="ghost" size="sm" className="h-6 text-xs">+ Add tag</Button>
    </div>
  </div>

  {/* Metadata table */}
  <div>
    <SectionHeading>METADATA</SectionHeading>
    <dl className="mt-2 space-y-2 text-sm">
      <MetadataRow label="Type" value={capitalize(document.type)} />
      <MetadataRow label="Domain" value={domain} />
      <MetadataRow label="Published" value={formatDate(publishedAt)} />
      <MetadataRow label="Length" value={`${readingTime} mins (${wordCount} words)`} />
      <MetadataRow label="Saved" value={timeAgo(savedAt)} />
      <MetadataRow label="Progress" value={`${progress}% (${remainingTime} left)`} />
    </dl>
  </div>
</div>
```

**`SectionHeading` component:** `<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">`

**`MetadataRow` component:**
```
<div className="flex justify-between">
  <dt className="text-muted-foreground">{label}</dt>
  <dd className="text-foreground font-medium">{value}</dd>
</div>
```

### 5.6 Empty State (No Document Selected)

When no document is selected, the reading pane shows:
```
<div className="flex flex-col items-center justify-center h-full text-center">
  <BookOpen className="size-16 text-muted-foreground/20 mb-4" />
  <p className="text-sm text-muted-foreground">Select a document to start reading</p>
  <p className="text-xs text-muted-foreground mt-1">
    Or press <Kbd>A</Kbd> to add a new URL
  </p>
</div>
```

---

## 6. Add Content

### 6.1 Add Content Dropdown

Triggered by the `+` button in the sidebar brand bar.

**Component:** shadcn `DropdownMenu`

| Icon       | Label    | Shortcut  | Action                                 |
|------------|----------|-----------|----------------------------------------|
| `Link`     | URL      | `a`       | Opens URL save dialog                  |
| `Bookmark` | Bookmark | `Shift+A` | Opens URL save dialog in bookmark mode |

### 6.2 URL Save Dialog

**Component:** `components/documents/add-url-dialog.tsx`
**Trigger:** `+` → URL, or keyboard shortcut `a`

Uses shadcn `Dialog` component:

```
┌──────────────────────────────────────┐
│ Add URL                           ✕  │
├──────────────────────────────────────┤
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Paste a URL...                   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ○ Article (extract content)          │
│ ○ Bookmark (save link only)          │
│                                      │
│                       [Cancel] [Save]│
└──────────────────────────────────────┘
```

**Behavior:**
1. User pastes a URL into the input (`Input` component, autofocused)
2. Type detection radio group (shadcn `RadioGroup`):
   - **Article** (default): Fetch and extract with Readability
   - **Bookmark**: Save metadata only (title, description, favicon, OG image)
3. On "Save" (`Button` primary):
   - Show loading spinner on the button
   - `POST /api/documents` with `{ url, type }`
   - On success: close dialog, select the new document in the list, show toast "Document saved"
   - On error: show inline error message below the input
   - On duplicate: show "This URL is already saved" with link to the existing document
4. Keyboard: `Enter` submits, `Escape` closes

---

## 7. Tag System

### 7.1 Tag Badge

**Component:** `components/tags/tag-badge.tsx`

```
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                 bg-primary/10 text-primary">
  <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
  {tag.name}
  {removable && (
    <button className="ml-0.5 hover:text-destructive">
      <X className="size-3" />
    </button>
  )}
</span>
```

### 7.2 Tag Picker

**Component:** `components/tags/tag-picker.tsx`

A shadcn `Popover` with `Command` (combobox) inside:

```
┌─────────────────────────┐
│ 🔍 Search or create...  │
├─────────────────────────┤
│ ☑ ai-coding             │
│ ☐ blogging              │
│ ☐ architecture          │
│ ☐ books-to-read         │
├─────────────────────────┤
│ + Create "new-tag-name" │
└─────────────────────────┘
```

- Searchable/filterable list of existing tags
- Checked tags are currently assigned to the document/subscription
- Toggle a tag on/off with a click
- If search text doesn't match any existing tag, show "Create [tag-name]" option at the bottom
- Creating a new tag: inline — just type and select the create option
- Color: auto-assigned from a preset palette on creation, editable in settings

---

## 8. Subscription Management

### 8.1 Subscriptions List Page

**Route:** `app/(reader)/subscriptions/page.tsx`

Replaces the document list and reading pane with a full-width table (similar to Readwise Tags view).

```
┌──────────────────────────────────────────────────────────────────────┐
│ Subscriptions                                    [+ New Subscription]│
├──────────────────────────────────────────────────────────────────────┤
│ ☐  NAME ▲        EMAIL                  TAGS    UNREAD  LAST RECEIVED│
├──────────────────────────────────────────────────────────────────────┤
│ ☐  Morning Brew  mb@read.focus...  📎copy  ●ai  3       2h ago       │
│ ☐  Substack ABC  sa@read.focus...  📎copy  ●dev 1       1d ago       │
│ ☐  Tech Daily    td@read.focus...  📎copy       0       3d ago       │
│                                                                      │
│                                                         Count: 12    │
└──────────────────────────────────────────────────────────────────────┘
```

**Table columns:**

| Column        | Content                                                  | Sortable |
|---------------|----------------------------------------------------------|----------|
| Name          | Display name (click to inline-edit)                      | Yes      |
| Email         | Pseudo email with copy button                            | No       |
| Tags          | Tag badges with "+" button to add                        | No       |
| Unread        | Count of unread documents from this subscription         | Yes      |
| Last Received | Relative time of most recent document                    | Yes      |
| Active        | Toggle switch (`Switch` component)                       | No       |
| Actions       | "..." dropdown on hover (Rename, View documents, Delete) | No       |

**Inline rename:** Click the display name → transforms into an `Input`, press Enter to save, Escape to cancel. Calls `PATCH /api/subscriptions/[id]`.

**Copy email:** Click the clipboard icon next to the pseudo email → copies to clipboard, shows toast "Email address copied".

**Row click** (on the name): Navigates to `/subscriptions/[id]` to show documents from that subscription.

### 8.2 New Subscription Dialog

**Trigger:** "+ New Subscription" button

Uses shadcn `Dialog`:

```
┌──────────────────────────────────────┐
│ New Subscription                  ✕  │
├──────────────────────────────────────┤
│                                      │
│ Display Name                         │
│ ┌──────────────────────────────────┐ │
│ │ e.g. Morning Brew                │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Your subscription email:             │
│ ┌──────────────────────────────────┐ │
│ │ morning-brew@read.example.com 📋 │ │
│ └──────────────────────────────────┘ │
│ Forward newsletters to this address  │
│                                      │
│                             [Create] │
└──────────────────────────────────────┘
```

**Behavior:**
1. User types a display name
2. Pseudo email is auto-generated in real-time from the display name (slugified: "Morning Brew" → `morning-brew@read.{domain}`)
3. Copy button copies the pseudo email
4. "Create" calls `POST /api/subscriptions`
5. On success: close dialog, show the new subscription in the list, show toast

---

## 9. Settings

### 9.1 Settings Layout

**Route:** `app/settings/layout.tsx`

Two-column layout (like Readwise Preferences):

```
┌──────────────────────────────────────────────────────┐
│ Settings                                             │
├──────────────┬───────────────────────────────────────┤
│ Email        │ [Settings content for active section] │
│ Denylist     │                                        │
│ Ingestion Log│                                        │
│ About        │                                        │
└──────────────┴───────────────────────────────────────┘
```

Left nav: vertical list of setting sections using shadcn `Tabs` (vertical orientation) or simple links.

### 9.2 Email Settings

**Route:** `app/settings/email/page.tsx`

```
Email Domain
Your email ingestion domain for newsletter subscriptions.

┌──────────────────────────────────────────────┐
│ read.example.com                          📋 │
└──────────────────────────────────────────────┘
Forward newsletters to {name}@read.example.com
```

Display-only (configured via environment variable). Shows the domain with a copy button.

### 9.3 Denylist Management

**Route:** `app/settings/denylist/page.tsx`

```
Denylist
Block emails from specific domains.

┌────────────────────────────────────┐
│ Add domain...              [Block] │
└────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ spam-domain.com     Added 2d ago      [Remove]│
│ marketing.co        Added 1w ago      [Remove]│
└──────────────────────────────────────────────┘
```

- Input + button to add a new domain
- List of existing denylist entries with remove button
- Add: `POST /api/denylist` → adds to list, shows toast
- Remove: Confirmation dialog → `DELETE /api/denylist/[id]`

### 9.4 Ingestion Log

**Route:** `app/settings/ingestion-log/page.tsx`

```
Ingestion Log
Recent email processing events.

┌──────────────────────────────────────────────────────────┐
│ STATUS   DOCUMENT             CHANNEL   TIME     DETAILS │
├──────────────────────────────────────────────────────────┤
│ ✓ OK     Morning Brew #412   email      2h ago           │
│ ✓ OK     Substack Post        email     3h ago           │
│ ✗ FAIL   —                    email     5h ago   [View]  │
│ ✓ OK     Tech Article         api       1d ago           │
└──────────────────────────────────────────────────────────┘
```

- Table of recent `IngestionLog` entries
- Status column: green check for success, red X for failure
- "View" link on failures: expands to show `error_code` and `error_detail`
- Paginated, 50 per page
- Sort by `received_at DESC` (most recent first)

---

## 10. Keyboard Shortcuts

All shortcuts are disabled when focus is inside an input/textarea element.

**Implementation:** `hooks/useKeyboardShortcuts.ts` using `useEffect` with `keydown` event listener.

**Reference:** Full Readwise Reader shortcut list below. Each shortcut is marked as **Phase 1** (implement now), **Phase 2+** (defer), or **N/A** (not applicable to Focus Reader).

### 10.1 Phase 1 Shortcuts

| Key              | Action                              | Context       | Readwise Key |
|------------------|-------------------------------------|---------------|--------------|
| `?`              | Show keyboard shortcuts help dialog | Global        | `?`          |
| `Escape`         | Exit focus mode / close dialog      | Global        | —            |
| `a`              | Save doc from URL                   | Global        | `a`          |
| `/`              | Focus search (placeholder Phase 1)  | Global        | `/`          |
| `↓`              | Navigate to next document           | Document list | `↓` or `j`   |
| `↑`              | Navigate to previous document       | Document list | `↑` or `k`   |
| `Enter`          | Open selected document              | Document list | —            |
| `t`              | Add / edit tags for document        | Reading view  | `t`          |
| `f`              | Add to favorites (star)             | Reading view  | `f`          |
| `Space`          | Mark document as read / unread      | Reading view  | `Space`      |
| `e`              | Move to Archive                     | Reading view  | `e`          |
| `Shift+E`        | Move to Inbox                       | Reading view  | `Shift+E`    |
| `l`              | Move to Later                       | Reading view  | `l`          |
| `d`              | Delete document                     | Reading view  | `d`          |
| `Shift+C`        | Copy original URL                   | Reading view  | `Shift+C`    |
| `o`              | View on web (open original URL)     | Reading view  | `o`          |
| `m`              | Toggle more actions dropdown        | Reading view  | `m`          |
| `[`              | Toggle left panel (TOC / sidebar)   | Global        | `[`          |
| `]`              | Toggle right panel (info)           | Global        | `]`          |
| `Tab`            | Cycle forward through splits        | Global        | `Tab`        |
| `Shift+Tab`      | Cycle backward through splits       | Global        | `Shift+Tab`  |
| `Shift+H`        | Toggle HTML / Markdown view         | Reading view  | — (FR only)  |

### 10.2 Phase 2+ Shortcuts (Deferred)

| Key              | Action                                | Readwise Key     | Phase   |
|------------------|---------------------------------------|------------------|---------|
| `Cmd+K`          | Open command palette                  | `Cmd+K`          | Phase 2 |
| `Shift+N`        | Add a document note                   | `Shift+N`        | Phase 2 |
| `Shift+Option+C` | Copy annotations to clipboard         | `Shift+Option+C` | Phase 2 |
| `Ctrl+Shift+F`   | Cycle typeface                        | `Ctrl+Shift+F`   | Phase 2 |
| `Shift+=`        | Increase font size                    | `Shift+=`        | Phase 2 |
| `Shift+-`        | Decrease font size                    | `Shift+-`        | Phase 2 |
| `Shift+"`        | Increase line spacing                 | `Shift+"`        | Phase 2 |
| `Shift+:`        | Decrease line spacing                 | `Shift+:`        | Phase 2 |
| `Shift+.`        | Widen line length                     | `Shift+.`        | Phase 2 |
| `Shift+,`        | Narrow line length                    | `Shift+,`        | Phase 2 |
| `Cmd+Option+T`   | Toggle dark mode                      | `Cmd+Option+T`   | Phase 2 |
| `Cmd+Shift+\`    | Toggle focus mode                     | `Cmd+Shift+\`    | Phase 2 |
| `Cmd+\`          | Toggle all panels hidden              | `Cmd+\`          | Phase 2 |
| `v`              | Open quick view switcher              | `v`              | Phase 2 |
| `Shift+F`        | Filter all documents                  | `Shift+F`        | Phase 2 |
| `Shift+R`        | Reset reading progress                | `Shift+R`        | Phase 2 |
| `Shift+M`        | Edit metadata                         | `Shift+M`        | Phase 2 |
| `Shift+X`        | Collapse/expand all sidebar items     | `Shift+X`        | Phase 2 |
| `Shift+B`        | Apply bulk actions                    | `Shift+B`        | Phase 2 |

### 10.3 Not Applicable to Focus Reader

These Readwise shortcuts are **not planned** for Focus Reader:

| Key           | Action                                       | Reason                     |
|---------------|----------------------------------------------|----------------------------|
| `s`           | Add to shortlist                             | No shortlist concept in FR |
| `b`           | Bump document to top                         | No bump feature            |
| `Shift+L`     | Copy Reader URL                              | No public sharing          |
| `Shift+A`     | Add/remove RSS subscriptions                 | No RSS in Phase 1          |
| `Shift+S`     | Subscribe/unsubscribe to document's RSS feed | No RSS in Phase 1          |
| `Option+S`    | Enable / view public link                    | No public sharing          |
| `u`           | Upload file                                  | No file upload             |
| `Cmd+P`       | Print document with annotations              | No print support           |
| `y`           | Redo                                         | No annotation editing      |
| `z`           | Undo                                         | No annotation editing      |
| `` ` ``       | Cycle forward through document sidebar tabs  | Simplified sidebar         |
| `` Shift+` `` | Cycle backward through document sidebar tabs | Simplified sidebar         |
| `p`           | Play / pause text-to-speech                  | No TTS                     |
| `Shift+P`     | Stop and hide TTS player                     | No TTS                     |
| `Shift+↑`/`↓` | Increase / decrease TTS volume               | No TTS                     |
| `←`/`→`       | Skip backward/forward in TTS audio           | No TTS                     |
| `,`/`.`       | Slow down / speed up TTS playback            | No TTS                     |

### 10.4 Keyboard Shortcuts Help Dialog

Triggered by `?` key. Uses shadcn `Dialog` to show a table of Phase 1 shortcuts grouped by context (Navigation, Document actions, Panel controls, Global).

---

## 11. Toast Notifications

Use shadcn `Sonner` (toast) for transient feedback messages.

| Event                   | Toast                                                    | Duration |
|-------------------------|----------------------------------------------------------|----------|
| Document saved          | "Document saved"                                         | 3s       |
| Document archived       | "Moved to archive" with "Undo" button                    | 5s       |
| Document moved to later | "Moved to later" with "Undo" button                      | 5s       |
| Document deleted        | "Document deleted" with "Undo" button                    | 5s       |
| Tag added               | "Tag added"                                              | 2s       |
| Tag removed             | "Tag removed"                                            | 2s       |
| URL copied              | "Copied to clipboard"                                    | 2s       |
| Email copied            | "Email address copied"                                   | 2s       |
| Error                   | Red: "Something went wrong: {message}"                   | 5s       |
| Duplicate URL           | "This URL is already in your library" with "View" button | 5s       |

**Undo behavior:** Triage actions (archive, move to later, delete) show an "Undo" button in the toast. Clicking undo calls the reverse API operation (e.g., move back to inbox).

---

## 12. Loading States

### 12.1 Skeleton Loading

Use shadcn `Skeleton` component for initial page loads:

**Document list skeleton:** 8 rows of:
```
<div className="flex gap-3 px-4 py-3 border-b">
  <Skeleton className="size-14 rounded" />
  <div className="flex-1 space-y-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-1/2" />
  </div>
</div>
```

**Reading pane skeleton:**
```
<div className="max-w-[680px] mx-auto px-6 py-8 space-y-4">
  <Skeleton className="h-3 w-24" />
  <Skeleton className="h-8 w-full" />
  <Skeleton className="h-8 w-3/4" />
  <Skeleton className="h-4 w-48 mt-4" />
  <Skeleton className="h-64 w-full mt-8 rounded-lg" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-2/3" />
</div>
```

### 12.2 Inline Loading

- **Save URL button:** Shows `Loader2` spinner inside the button, button disabled
- **Triage actions:** Optimistic UI — immediately move the document in the list, revert on error
- **Tag operations:** Optimistic — immediately show/remove the tag badge, revert on error
- **Infinite scroll:** `Loader2` spinner centered below the last document row

---

## 13. SWR Data Fetching Hooks

### 13.1 `hooks/useDocuments.ts`

```typescript
function useDocuments(filters: {
  location?: DocumentLocation;
  type?: DocumentType;
  source_id?: string;
  tag_id?: string;
  is_starred?: boolean;
  sort?: string;
  page?: number;
}): {
  documents: Document[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  mutate: KeyedMutator<...>;
}
```

- SWR key: `/api/documents?${searchParams}`
- Infinite loading via `useSWRInfinite`
- Optimistic updates for triage, star, read status

### 13.2 `hooks/useDocument.ts`

```typescript
function useDocument(id: string | null): {
  document: Document & { tags: Tag[], emailMeta?: DocumentEmailMeta };
  isLoading: boolean;
  mutate: KeyedMutator<...>;
}
```

### 13.3 `hooks/useSubscriptions.ts`

```typescript
function useSubscriptions(): {
  subscriptions: SubscriptionWithStats[];
  isLoading: boolean;
  mutate: KeyedMutator<...>;
}
```

### 13.4 `hooks/useTags.ts`

```typescript
function useTags(): {
  tags: TagWithCount[];
  isLoading: boolean;
  mutate: KeyedMutator<...>;
}
```

---

## 14. URL Routing & State Management

### 14.1 Route Structure

| Route                 | View                    | Document List Filter |
|-----------------------|-------------------------|----------------------|
| `/inbox`              | Inbox                   | `location=inbox`     |
| `/later`              | Later                   | `location=later`     |
| `/archive`            | Archive                 | `location=archive`   |
| `/all`                | All documents           | No location filter   |
| `/starred`            | Starred                 | `is_starred=1`       |
| `/subscriptions`      | Subscription management | — (table view)       |
| `/subscriptions/[id]` | Subscription documents  | `source_id=[id]`     |
| `/tags/[id]`          | Tag documents           | `tag_id=[id]`        |
| `/settings/*`         | Settings pages          | —                    |

### 14.2 Document Selection State

The selected document ID is stored in the URL as a query parameter: `?doc=[id]`

Example: `/inbox?doc=abc123` — shows the inbox list with document `abc123` open in the reading pane.

This ensures:
- Browser back/forward works for document navigation
- Shareable URLs that deep-link to a specific document
- No React state lost on page refresh

### 14.3 View Preferences

Ephemeral UI state stored in React context (not URL):
- Sidebar collapsed/expanded
- Focus mode on/off
- Info panel visible/hidden
- TOC panel visible/hidden
- HTML/Markdown content mode

---

## 15. Component File Structure

```
apps/web/
├── app/
│   ├── layout.tsx                    # Root layout, providers, global styles
│   ├── page.tsx                      # Redirect to /inbox
│   ├── (reader)/
│   │   ├── layout.tsx                # Three-pane shell
│   │   ├── inbox/page.tsx
│   │   ├── later/page.tsx
│   │   ├── archive/page.tsx
│   │   ├── all/page.tsx
│   │   ├── starred/page.tsx
│   │   ├── subscriptions/
│   │   │   ├── page.tsx              # Subscription management table
│   │   │   └── [id]/page.tsx         # Documents for a subscription
│   │   └── tags/
│   │       └── [id]/page.tsx         # Documents for a tag
│   ├── settings/
│   │   ├── layout.tsx                # Settings two-column layout
│   │   ├── page.tsx                  # Redirect to /settings/email
│   │   ├── email/page.tsx
│   │   ├── denylist/page.tsx
│   │   └── ingestion-log/page.tsx
│   └── api/                          # (API routes from Step 7)
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── document-list.tsx
│   │   ├── document-list-header.tsx
│   │   ├── reading-pane.tsx
│   │   ├── reading-toolbar.tsx
│   │   └── mobile-nav.tsx
│   ├── documents/
│   │   ├── document-row.tsx
│   │   ├── document-reader.tsx
│   │   ├── info-panel.tsx
│   │   ├── table-of-contents.tsx
│   │   ├── add-url-dialog.tsx
│   │   └── empty-state.tsx
│   ├── subscriptions/
│   │   ├── subscription-table.tsx
│   │   ├── subscription-row.tsx
│   │   └── new-subscription-dialog.tsx
│   ├── tags/
│   │   ├── tag-badge.tsx
│   │   └── tag-picker.tsx
│   ├── settings/
│   │   ├── email-settings.tsx
│   │   ├── denylist-manager.tsx
│   │   └── ingestion-log-table.tsx
│   └── ui/                           # shadcn/ui components (auto-generated)
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── popover.tsx
│       ├── command.tsx
│       ├── tabs.tsx
│       ├── switch.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── skeleton.tsx
│       ├── sheet.tsx
│       ├── sonner.tsx (toast)
│       ├── radio-group.tsx
│       ├── scroll-area.tsx
│       └── separator.tsx
├── hooks/
│   ├── use-documents.ts
│   ├── use-document.ts
│   ├── use-subscriptions.ts
│   ├── use-tags.ts
│   ├── use-keyboard-shortcuts.ts
│   ├── use-auto-mark-read.ts
│   └── use-focus-mode.ts
├── lib/
│   ├── api-client.ts                 # Fetch wrapper for /api/* routes
│   ├── format.ts                     # Date formatting, time ago, reading time
│   └── cn.ts                         # Tailwind cn() utility (clsx + twMerge)
└── styles/
    └── globals.css                   # Tailwind directives + CSS variables
```

---

## 16. shadcn/ui Components Required

The following shadcn/ui components need to be installed:

```bash
npx shadcn@latest add button input dialog dropdown-menu popover command tabs switch avatar badge skeleton sheet sonner radio-group scroll-area separator tooltip
```

All components use the "new-york" style variant for a clean, minimal look matching the Readwise aesthetic.

---

## 17. Deferred to Phase 2+

The following UI elements are explicitly **not** built in Phase 1 but accounted for in the layout:

| Feature                                 | Phase 1 Placeholder                                   |
|-----------------------------------------|-------------------------------------------------------|
| Dark mode                               | Theme CSS variables defined but only light values set |
| Search                                  | Sidebar "Search" item shown disabled with tooltip     |
| Typography controls (Aa)                | Toolbar button shown disabled                         |
| Highlights/Annotations                  | Info panel "Notebook" tab shown disabled              |
| Collections                             | Not shown in sidebar                                  |
| RSS feeds                               | Not shown in sidebar                                  |
| Home dashboard                          | Not built; `/` redirects to `/inbox`                  |
| Reading preferences (font, size, width) | Not built                                             |
| Browser extension                       | Not built                                             |
| PDF viewer                              | Not built                                             |

---

## 18. Relationship to Other Specifications

- **[Focus Reader PRD](./focus-reader-prd.md):** Product requirements and data model
- **[Email Newsletter PRD](./email-newsletter-prd.md):** Email ingestion details, subscription model
- **[Phase 1 Plan](../plans/phase-1-plan.md):** Implementation steps 6–9 that this UI spec details
- **[Repo Structure](./repo-structure.md):** File organization for `apps/web`
