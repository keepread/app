# Focus Reader

A self-hosted, open-source read-it-later application that unifies web articles, email newsletters, RSS feeds, PDFs, and bookmarks into a single distraction-free reading interface. Deployed to your own Cloudflare account (Workers, D1, R2) — you own your data.

## Features

- **Email newsletter ingestion** — Subscribe to newsletters with per-subscription pseudo email addresses (`techweekly@read.yourdomain.com`). Emails are parsed, sanitized, and stored automatically.
- **RSS feed aggregation** — Add RSS/Atom feeds and automatically ingest new articles on a schedule.
- **Browser extension** — Save bookmarks and full-page content from Chrome with one click.
- **PDF upload** — Upload PDFs (up to 50 MB) stored in R2 with inline viewing.
- **Full-text search** — Search across all documents via D1 FTS5.
- **Saved views** — Create filtered views by type, tag, read status, and date range.
- **HTML sanitization** — Strips tracking pixels, scripts, and unsafe content while preserving layout and images.
- **Markdown conversion** — All content stored as Markdown for portability and easy export.
- **Deduplication** — Prevents duplicate documents via Message-ID and SHA-256 fingerprint matching.
- **CID image support** — Inline email images uploaded to R2 and served via proxy URLs.
- **Tagging & organization** — Tag feeds, subscriptions, and documents. Auto-inherit tags on new content.
- **OPML import/export** — Import feeds from other readers and export your feed list.
- **API key management** — Create API keys for programmatic access.
- **Sender denylist** — Block unwanted senders by email pattern.
- **Ingestion log** — Track email processing results and errors.

## Architecture

Focus Reader is a PNPM monorepo with Turborepo for task orchestration:

```
packages/
  shared/        — TypeScript types, constants, utility functions
  db/            — D1 schema migrations, typed query helpers
  parser/        — Email parsing (postal-mime), HTML sanitization (linkedom),
                   Markdown conversion (turndown), dedup, validation
  api/           — Business logic and REST API layer
apps/
  web/           — Next.js frontend + API routes (deployed via OpenNext on Cloudflare)
  email-worker/  — Cloudflare Email Worker (newsletter ingestion pipeline)
  rss-worker/    — Cloudflare Worker (scheduled RSS feed polling)
  extension/     — Chrome browser extension (WXT framework)
scripts/
  deploy.sh         — Build, migrate, and deploy to Cloudflare
  ingest-local.ts   — Local email ingestion for testing (Miniflare)
  sync-secrets.sh   — Propagate env vars to .dev.vars files
```

All data lives in your Cloudflare account:
- **D1** (SQLite) — Documents, subscriptions, feeds, tags, saved views, API keys, metadata
- **R2** (object storage) — PDF files, inline email images, and attachments

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
# Set up local .dev.vars files
cp .dev.vars.example apps/web/.dev.vars
cp .dev.vars.example apps/email-worker/.dev.vars
# Edit both files with your values

# Apply migrations to local D1 (required before first run)
pnpm db:migrate

# Start the web app locally
pnpm --filter focus-reader-web dev

# Start the email worker locally (in another terminal, if needed)
pnpm --filter focus-reader-email-worker dev
```

### Scripts

**`scripts/ingest-local.ts`** — Local email ingestion for testing. Reads a `.eml` file, spins up a Miniflare instance with the email worker, applies D1 migrations, invokes the email handler, and prints stored documents.

```bash
# Build first (the ingestion script uses the compiled worker)
pnpm build

# Ingest an .eml file
pnpm tsx scripts/ingest-local.ts path/to/email.eml

# Override the recipient address
pnpm tsx scripts/ingest-local.ts path/to/email.eml --recipient user@level-up.dev
```

**`scripts/deploy.sh`** — Builds, type-checks, runs remote D1 migrations, and deploys to Cloudflare. Accepts a target argument:

```bash
./scripts/deploy.sh          # deploy everything (web + email + rss)
./scripts/deploy.sh web      # deploy only the web app
./scripts/deploy.sh email    # deploy only the email worker
./scripts/deploy.sh rss      # deploy only the RSS worker
```

**`scripts/sync-secrets.sh`** — Propagates `EMAIL_DOMAIN`, `COLLAPSE_PLUS_ALIAS`, and `OWNER_EMAIL` to `.dev.vars` files for local development across `apps/email-worker` and `apps/web`.

```bash
EMAIL_DOMAIN=read.yourdomain.com OWNER_EMAIL=you@example.com ./scripts/sync-secrets.sh
```

### Deployment

Focus Reader has three deployable components on Cloudflare. All commands assume you are at the repo root.

#### Prerequisites

1. Update `wrangler.toml` files with your Cloudflare account ID, D1 database ID, R2 bucket names, domain, and `EMAIL_DOMAIN` var. See [cloudflare-installation-instructions.md](cloudflare-installation-instructions.md) for a detailed checklist.
2. Set required secrets via `wrangler secret put`:

```bash
cd apps/web
wrangler secret put OWNER_EMAIL          # e.g. you@example.com
wrangler secret put CF_ACCESS_TEAM_DOMAIN # e.g. your-team (or your-team.cloudflareaccess.com)
wrangler secret put CF_ACCESS_AUD        # Cloudflare Access Application Audience tag
```

`EMAIL_DOMAIN` and `COLLAPSE_PLUS_ALIAS` are set as `[vars]` in `wrangler.toml`, not as secrets.

3. Configure [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/) to protect your web app domain. CF Access provides authentication via a JWT cookie (`CF_Authorization`).

4. Configure [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) to forward `*@read.yourdomain.com` to the email worker.

#### 1. Apply D1 Migrations

```bash
pnpm --filter @focus-reader/db exec -- \
  wrangler d1 migrations apply FOCUS_DB --remote
```

#### 2. Deploy the Web App

The web app uses [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) to deploy Next.js on Workers:

```bash
cd apps/web
pnpm exec opennextjs-cloudflare build && pnpm exec wrangler deploy
```

#### 3. Deploy the Email Worker

```bash
pnpm --filter focus-reader-email-worker exec -- wrangler deploy
```

#### 4. Deploy the RSS Worker

```bash
pnpm --filter focus-reader-rss-worker exec -- wrangler deploy
```

#### Quick Deploy (All Components)

```bash
./scripts/deploy.sh
```

Or manually:

```bash
pnpm build

pnpm --filter @focus-reader/db exec -- wrangler d1 migrations apply FOCUS_DB --remote

cd apps/web && pnpm exec opennextjs-cloudflare build && pnpm exec wrangler deploy && cd ../..
pnpm --filter focus-reader-email-worker exec -- wrangler deploy
pnpm --filter focus-reader-rss-worker exec -- wrangler deploy
```

## Configuration

Environment variables (set in `wrangler.toml`, `.dev.vars`, or as Wrangler secrets):

| Variable                | Description                                        | Default               |
|-------------------------|----------------------------------------------------|-----------------------|
| `EMAIL_DOMAIN`          | Catch-all email subdomain                          | `read.yourdomain.com` |
| `COLLAPSE_PLUS_ALIAS`   | Collapse `tech+ai` to `tech` for subscription keys | `false`               |
| `OWNER_EMAIL`           | Owner email for auth verification                  | —                     |
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Access team domain (omit for dev mode)  | —                     |
| `CF_ACCESS_AUD`         | Cloudflare Access audience tag (omit for dev mode) | —                     |

When `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are not set, authentication is disabled (dev mode passthrough).

## Project Status

- **Phase 0** (complete) — Email ingestion pipeline: parse, sanitize, store, deduplicate
- **Phase 1** (complete) — REST API, web reading interface, search, tags, subscriptions
- **Phase 2** (complete) — RSS feeds, OPML import/export, browser extension, PDF upload, saved views, API keys, denylist, ingestion log

## License

See [LICENSE](LICENSE).
