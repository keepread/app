# Claude Code Instructions

See [AGENTS.md](AGENTS.md) for project documentation, conventions, and detailed guides.

## Before Starting Work

1. Read `AGENTS.md` for project structure and constraints.
2. Read the relevant guide from `agents/docs/` for the area you're working on:
   - Changing packages (shared/db/parser/api) → `agents/docs/typescript-conventions.md`
   - Writing or fixing tests → `agents/docs/testing.md`
   - Working on the web app → `agents/docs/web-app.md`
   - Working on email ingestion → `agents/docs/email-worker.md`
   - Cloudflare bindings or local dev issues → `agents/docs/cloudflare.md`
3. Read the relevant spec from `agents/spec/` before implementing new features.

## Before Committing

Always verify: `pnpm build && pnpm typecheck && pnpm test`
