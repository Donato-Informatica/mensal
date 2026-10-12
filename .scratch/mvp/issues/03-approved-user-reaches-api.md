# 03: An approved user can reach the API

**What to build:** a user can sign up and sign in against the Express API; only once an administrator sets them as approved in the database can they call `/api/v1` routes, everyone else gets `403 USER_NOT_APPROVED`. Lays down the database package and the integration-test harness against a real Postgres. Source: `docs/prd.md` §3.4, §8.2, §8.3, §8.5.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] docker-compose runs Postgres 17 and Adminer locally
- [ ] `@database` holds the Drizzle connection (`casing: 'snake_case'`) and the Better-Auth schema generated for the Drizzle adapter with plural table names, including `approved` (boolean, default false, not settable on sign-up)
- [ ] drizzle-kit `generate` + `migrate` is the only migration system; the first migration creates the auth tables
- [ ] Better-Auth is mounted inside the Express app with email + password and HttpOnly `SameSite=Lax` session cookies, sharing the same `db` instance
- [ ] A middleware injects the verified `userId` on `/api/v1` and rejects unapproved users with `403 USER_NOT_APPROVED`; a trivial authenticated route proves it
- [ ] The session exposes `approved` so a client can tell an unapproved user apart
- [ ] Integration tests against the compose Postgres (no DB mocks): unauthenticated → 401, signed-in but unapproved → 403 `USER_NOT_APPROVED`, approved → 200; sign-up cannot set `approved`
