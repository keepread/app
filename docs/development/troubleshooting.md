# Troubleshooting

## Common Issues

- Missing Cloudflare bindings locally -> verify `wrangler.toml` and dev init wiring
- Worker tests failing in workerd -> review `docs/development/testing.md` gotchas
- Auth mismatch in multi-user mode -> verify `AUTH_MODE`, `AUTH_SECRET`, `BETTER_AUTH_URL`

## Related

- `docs/development/testing.md`
- `docs/architecture/auth-and-tenancy.md`
- `docs/architecture/cloudflare-runtime.md`
