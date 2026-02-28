# Local Development

## Quick Start

```bash
pnpm install
pnpm build
pnpm db:migrate
pnpm --filter focus-reader-web dev
```

Optional worker dev in parallel:

```bash
pnpm --filter focus-reader-email-worker dev
```

## Notes

- Build before tests (`pnpm build` then `pnpm test`)
- Web and workers use Cloudflare bindings; ensure `.dev.vars` files are configured

## Related

- `docs/architecture/cloudflare-runtime.md`
- `README.md`
