# Testing Patterns & Gotchas

## Test Frameworks

| Package        | Test Runner                                | Environment       |
|----------------|--------------------------------------------|-------------------|
| `shared`       | vitest                                     | Node.js           |
| `parser`       | vitest                                     | Node.js           |
| `api`          | vitest                                     | Node.js           |
| `db`           | vitest + `@cloudflare/vitest-pool-workers` | workerd (D1)      |
| `web`          | vitest                                     | Node.js           |
| `email-worker` | vitest + `@cloudflare/vitest-pool-workers` | workerd (D1 + R2) |
| `rss-worker`   | vitest + `@cloudflare/vitest-pool-workers` | workerd (D1)      |
| `extension`    | vitest                                     | Node.js           |

## Version Constraints

- **vitest** pinned to `~3.2.0` — `@cloudflare/vitest-pool-workers` does NOT support vitest 4.x
- **wrangler** `^4`
- **@cloudflare/vitest-pool-workers** `^0.12`

## Workerd Test Gotchas

1. **No filesystem reads** — `readFileSync` with `__dirname` paths fails in workerd. Embed data as module exports instead (see `packages/db/src/migration-sql.ts`).

2. **`db.exec()` bug** — `db.exec()` throws "Cannot read properties of undefined (reading 'duration')" in workerd. Use `db.prepare(stmt).run()` for individual statements.

3. **R2 isolated storage conflict** — `@cloudflare/vitest-pool-workers` isolated storage doesn't work with R2. The email-worker tests use `isolatedStorage: false` and manually clean up in `beforeEach`.

4. **Test file typecheck** — Test files importing `cloudflare:test` cause `tsc` errors. The `db` and `email-worker` tsconfigs exclude `src/__tests__` from typecheck (vitest handles type checking during test runs).

5. **EML fixtures in workerd tests** — Embed EML content as string constants in the test file, not as fixture files on disk.

6. **ReadableStream consumption** — Streams can only be read once. The email worker reads `message.raw` into an ArrayBuffer before the retry loop to avoid "stream already locked" errors on retry.

7. **Multi-tenancy test setup** — All integration tests (db, email-worker, rss-worker) must apply `MULTI_TENANCY_SQL` migration in addition to `INITIAL_SCHEMA_SQL` and `FTS5_MIGRATION_SQL`. Create a test user row before running tests. Use `scopeDb(env.FOCUS_DB, TEST_USER_ID)` to get a `UserScopedDb` context — do not pass raw `D1Database` to query functions.

8. **Web API test mocks** — When mocking `@focus-reader/db` in web API tests, use `importOriginal` to preserve real exports like `scopeDb`: `vi.mock("@focus-reader/db", async (importOriginal) => { const actual = await importOriginal(); return { ...actual, myMockedFn: vi.fn() }; })`. The `authenticateRequest` mock must return `userId: "test-user-id"`, and assertions on API/query calls should use `expect.objectContaining({ db: mockDb, userId: "test-user-id" })` for the `UserScopedDb` parameter.

## Test Fixtures

- `packages/parser/fixtures/` — `.eml` files for parser unit tests (read via `readFileSync` in Node.js)
- `apps/email-worker/fixtures/` — `.eml` files (reference only; actual test data is embedded as string constants due to workerd limitations)
