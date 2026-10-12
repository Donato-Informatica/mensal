# 14: API production image

**What to build:** a production-ready API container and web build, runnable locally against the compose Postgres, ready for Coolify. Source: `docs/prd.md` §8.1, §8.3, §8.4.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] Dockerfile builds the API image copying only the `api`, `shared` and `database` workspaces
- [x] Migrations are applied by drizzle-kit on start (never `auth migrate`)
- [x] Production build script for the web app's static files
- [x] Verified by running the image locally against the compose Postgres and hitting an authenticated route

## Comments

- Implemented. `docker build -t mensal-api .` builds from the root `Dockerfile`; `.dockerignore` is an allowlist (root manifests + `apps/api`, `packages/shared`, `packages/database`, minus `node_modules`, `.env` and `tests`). Base `node:24-slim`, runs as `node`, listens on `PORT` (default 3000).
- Env: `DATABASE_URL`, `BETTER_AUTH_URL` (the public origin, e.g. `https://mensal.example`), `BETTER_AUTH_SECRET`. The container refuses to start without `DATABASE_URL`.
- On start, `npm run -w @mensal/database migrate` (drizzle-kit) applies pending migrations, then `exec node apps/api/src/server.ts`. A failed migration exits 1 and the API never starts. `drizzle-kit` moved from devDependencies to dependencies of `@mensal/database` so it ships in the image.
- `server.ts` closes the HTTP server and the pool on SIGTERM (Node is PID 1 in the container); `docker stop` exits 0 in ~0.5s.
- Web: `npm run build:web` writes the static files to `apps/web/dist` (for ticket 15: install with `npm ci`, publish `apps/web/dist`).
- Verified locally against a scratch database on the compose network (`--network mensal_default`, `postgres://mensal:mensal@postgres:5432/<db>`): migrations created all tables; `/api/v1/me` returned 401 unauthenticated, 403 `USER_NOT_APPROVED` after sign-up, 200 after approval; `/api/v1/periods/2026-10` returned 200; restart re-ran migrations as a no-op.
- Known: the image is ~520MB. `vitest`/`vite` are optional peers of better-auth, and because the root dev tree installs them the lockfile marks them `devOptional`, so `npm ci --omit=dev` keeps them (~40MB). Dropping them would need `--omit=optional` (breaks esbuild's platform binary, which drizzle-kit needs) or giving up `npm ci`.
