# Documentation Index

This repository uses lifecycle-based docs:

- `docs/architecture/`: how the system currently works
- `docs/development/`: how to work on the codebase
- `docs/product/`: current product behavior/specs
- `docs/reference/`: stable lookup docs
- `docs/archive/`: historical intent/plans (non-authoritative)

## Doc Lifecycle

- `docs/architecture/`, `docs/development/`, `docs/product/`, and `docs/reference/` are **live docs** and should match current code behavior.
- `docs/archive/` is **historical** and preserved for context; it is not source-of-truth for implementation.

## How to Navigate

1. Start at `docs/README.md`.
2. Read `docs/product/` for current product behavior and scope.
3. Read `docs/architecture/` for how the system works.
4. Read `docs/development/` for build/test/change workflow.
5. Use `docs/reference/` for quick factual lookup.
6. Use `docs/archive/` only when historical context is explicitly needed.

## Update Rules

- Any behavior/system change should update at least one relevant live doc in the same PR.
- When specs/plans are no longer active, move them to `docs/archive/`.
- Archived docs should clearly indicate they are historical and may diverge from current implementation.

## Agent Guidance

- Agents should prioritize live docs (`architecture`, `development`, `product`, `reference`).
- Agents should not rely on `docs/archive/` unless the task explicitly asks for historical context.

## Start Here

- `docs/product/product-spec-current.md`
- `docs/architecture/overview.md`
- `docs/development/testing.md`
- `docs/reference/repo-structure.md`

## Live Docs

### Architecture

- `docs/architecture/overview.md`
- `docs/architecture/auth-and-tenancy.md`
- `docs/architecture/cloudflare-runtime.md`
- `docs/architecture/web-app.md`
- `docs/architecture/email-ingestion.md`
- `docs/architecture/rss-ingestion-and-queue.md`

### Development

- `docs/development/local-dev.md`
- `docs/development/testing.md`
- `docs/development/typescript-conventions.md`
- `docs/development/deployment.md`
- `docs/development/troubleshooting.md`

### Product

- `docs/product/product-spec-current.md`
- `docs/product/ui-spec-current.md`

### Reference

- `docs/reference/repo-structure.md`
- `docs/reference/browser-extension.md`
- `docs/reference/env-vars.md`
- `docs/reference/api-surface-map.md`
- `docs/reference/glossary.md`

## Historical Docs

- `docs/archive/specs/*`
- `docs/archive/plans/*`

Archived docs preserve context and decision history but may not match current implementation.
