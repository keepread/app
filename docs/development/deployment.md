# Deployment

## Components

- Web app (`apps/web`)
- Email worker (`apps/email-worker`)
- RSS worker (`apps/rss-worker`)

## Typical Flow

```bash
pnpm build
pnpm --filter @focus-reader/db exec -- wrangler d1 migrations apply FOCUS_DB --remote
./scripts/deploy.sh
```

## Related

- `README.md`
- `cloudflare-installation-instructions.md`
- `docs/architecture/cloudflare-runtime.md`
