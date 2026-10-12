# 03: An approved user can reach the API

**What to build:** a user can sign up and sign in against the Express API; only once an administrator sets them as approved in the database can they call `/api/v1` routes, everyone else gets `403 USER_NOT_APPROVED`. Lays down the database package and the integration-test harness against a real Postgres. Source: `docs/prd.md` §3.4, §8.2, §8.3, §8.5.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] docker-compose runs Postgres 17 and Adminer locally
- [x] `@database` holds the Drizzle connection (`casing: 'snake_case'`) and the Better-Auth schema generated for the Drizzle adapter with plural table names, including `approved` (boolean, default false, not settable on sign-up)
- [x] drizzle-kit `generate` + `migrate` is the only migration system; the first migration creates the auth tables
- [x] Better-Auth is mounted inside the Express app with email + password and HttpOnly `SameSite=Lax` session cookies, sharing the same `db` instance
- [x] A middleware injects the verified `userId` on `/api/v1` and rejects unapproved users with `403 USER_NOT_APPROVED`; a trivial authenticated route proves it
- [x] The session exposes `approved` so a client can tell an unapproved user apart
- [x] Integration tests against the compose Postgres (no DB mocks): unauthenticated → 401, signed-in but unapproved → 403 `USER_NOT_APPROVED`, approved → 200; sign-up cannot set `approved`

## Comments

- Implemented. `docker compose up -d` starts Postgres 17 (5432) and Adminer (8080). The integration tests use their own `mensal_test` database (override with `TEST_DATABASE_URL`), created and migrated by `apps/api/tests/global-setup.ts`, so `npm test` and the pre-commit hook now need the compose Postgres running.
- `@mensal/database` exposes `createDatabase(url)`, `migrate(db)` and the `schema` namespace. The PRD's `src/schema/auth.ts` lives at `lib/schema/auth.ts` to follow the package layout of `packages/README.md`. `migrate(db)` applies the drizzle-kit migrations through drizzle-orm's migrator (same folder and journal as `drizzle-kit migrate`); migrations are only written by `npm run -w @mensal/database generate`.
- Regenerate the auth schema with `npm run -w @mensal/api auth:generate` (reads `apps/api/auth.config.ts`). Do not pass `--adapter`: the CLI then ignores the configured `usePlural` and emits singular tables.
- `approved` is `required: true` with `defaultValue: false` and `input: false`, which makes the column `NOT NULL DEFAULT false`. Better-Auth silently ignores `approved` in a sign-up body rather than rejecting it.
- `/api/v1` errors are `{ code }`: `401 UNAUTHENTICATED` without a session, `403 USER_NOT_APPROVED` when not approved. The middleware puts the id in `res.locals.userId` (typed via `Express.Locals`). `GET /api/v1/me` returns `{ userId }`.
- The API runs on Node's native type stripping (`npm run -w @mensal/api dev`, env from `apps/api/.env`, see `.env.example`); no tsx needed.
