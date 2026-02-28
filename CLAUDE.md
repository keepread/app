# Claude Code Instructions

See [AGENTS.md](AGENTS.md) for project documentation, conventions, and detailed guides.

## Before Starting Work

1. Read `AGENTS.md` for project structure and constraints.
2. Read the relevant guide from `docs/` for the area you're working on:
   - Changing packages (shared/db/parser/api) → `docs/development/typescript-conventions.md`
   - Writing or fixing tests → `docs/development/testing.md`
   - Working on the web app → `docs/architecture/web-app.md`
   - Working on email ingestion → `docs/architecture/email-ingestion.md`
   - Cloudflare bindings or local dev issues → `docs/architecture/cloudflare-runtime.md`
3. For feature behavior/spec context, use live docs under `docs/product/` and `docs/reference/` first. Use `docs/archive/` only for historical context.

## Before Committing

Always verify: `pnpm build && pnpm typecheck && pnpm test`
