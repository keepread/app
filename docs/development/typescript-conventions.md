# TypeScript & Bundling Conventions

## Module System

- ESM only — import paths use `.js` extensions: `import { foo } from "./bar.js"`
- All packages have a barrel `src/index.ts` that re-exports everything

## Bundling

- Packages use **tsup** (ESM only, dts generation, es2022 target)
- Mark workspace dependencies as `external` in `tsup.config.ts` to avoid double-bundling
- `parser` also externalizes runtime deps: `postal-mime`, `linkedom`, `turndown`
- `email-worker` uses `wrangler` for bundling (not tsup)

## Entity Types

All entity interfaces live in `packages/shared/src/types.ts`. D1 conventions:

- `number` for booleans (0/1)
- `string` for timestamps (ISO 8601)
- `string` for UUIDs

Input types (e.g., `CreateDocumentInput`) have optional fields with defaults applied in query helpers.

All primary entity types (Document, Tag, Feed, Subscription, Highlight, Collection, etc.) include a `user_id: string` field for row-level multi-tenant isolation.

`CreateDocumentInput.id` is optional — when provided, the caller controls the UUID (needed for pre-generating document IDs for CID image R2 paths).

## Query Helpers

All in `packages/db/src/queries/`. Every function takes `ctx: UserScopedDb` as its first parameter — a wrapper containing `{ db: D1Database, userId: string }` defined in `packages/db/src/scoped-db.ts`. All queries automatically scope by `user_id`.

**Exceptions** that take raw `D1Database`:
- `packages/db/src/queries/admin.ts` — cross-tenant worker queries (e.g., `getAllFeedsDueForPoll`, `getOrCreateSingleUser`)
- Child-entity queries (`email-meta.ts`, `pdf-meta.ts`, `attachments.ts`) — scoped via parent `document_id` FK, not directly by `user_id`

## HTML Sanitization

Uses **linkedom** for DOM manipulation (NOT DOMPurify — it's incompatible with Workers). The sanitizer in `packages/parser/src/sanitize.ts`:

- Removes dangerous tags entirely (script, style, iframe, etc.)
- Unwraps non-allowed structural tags (html, body, header, nav, etc.) — promotes children
- Strips attributes not in the allowlist
- Strips `on*` event handler attributes
- Strips tracking pixels (1x1 images, known tracker domains)

**Pitfall:** Email HTML from postal-mime often includes `<html><body>` tags. The sanitizer wraps input in its own `<body>`, so inner `<html>` tags get unwrapped (children promoted) rather than removed with their subtrees.

## Markdown Conversion

Uses **turndown** with linkedom for DOM parsing. Turndown needs a `document` to parse HTML, which doesn't exist in Workers. The `htmlToMarkdown` function pre-parses HTML with linkedom and passes the DOM node to turndown.
