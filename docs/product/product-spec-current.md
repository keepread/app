# Focus Reader Product Spec (Current)

**Status:** Live  
**Last validated:** 2026-02-28

## Vision

Focus Reader gives users one place to capture, organize, and read long-form content from newsletters, RSS, web pages, and PDFs with strong ownership and portability.

## Product Principles

- Capture from multiple channels into one consistent reading surface
- Keep reading experience fast, clean, and keyboard-friendly
- Preserve user ownership (self-hosted friendly, exportable data)
- Support both single-user self-hosting and multi-user SaaS isolation

## Current Product State

Implemented capability areas:

- Ingestion: email newsletters, RSS polling, bookmark/article save, PDF upload
- Organization: tags, collections, saved views, subscriptions, feeds, denylist
- Reading: list + reader modes, highlights, notebook sidebar, reading preferences
- Search/export: full-text search, JSON export, Markdown export
- Auth/deployment modes: single-user and multi-user with row-level tenant isolation

## Deployment Modes

- `single-user`: optional CF Access + API key + auto-auth fallback
- `multi-user`: Better Auth magic-link session + API key

See technical details in:

- `docs/architecture/auth-and-tenancy.md`
- `docs/architecture/cloudflare-runtime.md`

## Scope Boundaries

Focus Reader is optimized for read-it-later workflows. It is not currently a social platform, collaborative editor, or generic CMS.

## Source-of-Truth Pointers

Use linked docs instead of duplicating implementation details:

- UI behavior: `docs/product/ui-spec-current.md`
- Architecture: `docs/architecture/overview.md`
- Web app details: `docs/architecture/web-app.md`
- Ingestion details: `docs/architecture/email-ingestion.md`
- Development workflow: `docs/development/testing.md`, `docs/development/typescript-conventions.md`
- Repository and extension references: `docs/reference/repo-structure.md`, `docs/reference/browser-extension.md`
