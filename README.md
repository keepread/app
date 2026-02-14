# Focus Reader

A self-hosted, open-source read-it-later application that unifies web articles, email newsletters, RSS feeds, PDFs, and bookmarks into a single distraction-free reading interface. Deployed to your own Cloudflare account (Workers, D1, R2, Pages) — you own your data.

## Features

- **Email newsletter ingestion** — Subscribe to newsletters with per-subscription pseudo email addresses (`techweekly@read.yourdomain.com`). Emails are parsed, sanitized, and stored automatically.
- **HTML sanitization** — Strips tracking pixels, scripts, and unsafe content while preserving layout and images.
- **Markdown conversion** — All content stored as Markdown for portability and easy export to Obsidian, Logseq, etc.
- **Deduplication** — Prevents duplicate documents via Message-ID and SHA-256 fingerprint matching.
- **CID image support** — Inline email images uploaded to R2 and served via proxy URLs.
- **Tagging & organization** — Tag subscriptions and auto-inherit tags on new documents.
- **Confirmation detection** — Automatically flags subscription confirmation emails.

## Architecture

Focus Reader is a PNPM monorepo with Turborepo for task orchestration:

```
packages/
  shared/     — TypeScript types, constants, utility functions
  db/         — D1 schema migrations, typed query helpers
  parser/     — Email parsing (postal-mime), HTML sanitization (linkedom),
                Markdown conversion (turndown), dedup, validation
  api/        — REST API (Phase 1)
apps/
  email-worker/  — Cloudflare Email Worker (ingestion pipeline)
  web/           — Next.js frontend (Phase 1)
```

All data lives in your Cloudflare account:
- **D1** (SQLite) — Documents, subscriptions, tags, metadata
- **R2** (object storage) — Inline email images and attachments

## Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/) >= 10
- A [Cloudflare](https://cloudflare.com) account with Email Routing, D1, and R2 enabled

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type-check
pnpm typecheck
```

### Local Development

```bash
# Start the email worker locally
pnpm --filter focus-reader-email-worker dev

# Start the web app locally
pnpm --filter focus-reader-web dev
```

### Database Migrations

```bash
# Apply migrations to local D1
pnpm --filter @focus-reader/db migrate
```

### Deployment

1. Update `wrangler.toml` files with your Cloudflare D1 database ID and R2 bucket name.
2. Set `EMAIL_DOMAIN` to your catch-all email subdomain (e.g., `read.yourdomain.com`).
3. Deploy:

```bash
# Deploy email worker
pnpm --filter focus-reader-email-worker deploy
```

4. Configure [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) to forward `*@read.yourdomain.com` to the email worker.

## Configuration

Environment variables (set in `wrangler.toml` or `.dev.vars`):

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_DOMAIN` | Catch-all email subdomain | `read.yourdomain.com` |
| `COLLAPSE_PLUS_ALIAS` | Collapse `tech+ai` to `tech` for subscription keys | `false` |

## Project Status

- **Phase 0** (complete) — Email ingestion pipeline: parse, sanitize, store, deduplicate
- **Phase 1** (planned) — REST API, web reading interface, search
- **Phase 2** (planned) — RSS feeds, browser extension, highlights

## License

See [LICENSE](LICENSE).
