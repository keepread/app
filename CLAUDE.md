# Claude Code Instructions

See [AGENTS.md](AGENTS.md) for full project documentation including architecture, conventions, testing gotchas, and common pitfalls.

## Quick Reference

- **Build:** `pnpm build && pnpm typecheck && pnpm test` (always verify before committing)
- **Single package:** `pnpm --filter @focus-reader/shared test`
- **Vitest version:** pinned to `~3.2.0` (do NOT upgrade — breaks `@cloudflare/vitest-pool-workers`)
- **Specs:** read `agents/spec/` and `agents/plans/` before implementing features
- **Types:** all entity interfaces in `packages/shared/src/types.ts`
- **Queries:** all in `packages/db/src/queries/`, take `db: D1Database` as first param
- **No DOMPurify:** use the manual linkedom sanitizer in `packages/parser/src/sanitize.ts`
