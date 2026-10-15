# mensal

Minimalist monthly cash-flow tracker: forecast and settle a person's monthly income and expenses. Recurrences project their occurrences at read time (virtual occurrences, [ADR-0001](docs/adr/0001-virtual-occurrences.md)); the first mutation materializes one. See [docs/prd.md](docs/prd.md) for the spec and [GLOSSARY.md](GLOSSARY.md) for domain vocabulary.

## Layout

npm-workspaces monorepo — no build step, TypeScript source is consumed directly.

- `apps/api` — Express server on :3000, Better-Auth + Drizzle (`/api/v1`).
- `apps/web` — React + Mantine + Vite on :5173, proxies `/api` to the API (same origin).
- `packages/database` — Drizzle schema and migrations (Postgres 17).
- `packages/shared` — shared domain types and the period-resolution logic.

## Running locally

Prerequisites: Node >= 24, Docker.

```sh
npm install

docker compose up -d          # Postgres on :5432, Adminer on :8080

cp apps/api/.env.example apps/api/.env
# set BETTER_AUTH_SECRET to a long random string: openssl rand -base64 32

npm run -w @mensal/database migrate

npm run -w @mensal/api dev     # :3000
npm run -w @mensal/web dev     # :5173 — open this one
```

Sign-up is open, but the API rejects unapproved users. Approve a user by setting `users.approved = true` directly in the database (e.g. via Adminer at http://localhost:8080). Password-reset links are printed to the API log.

### Demo data (optional)

To explore the app with example data, seed the local database (run it after `migrate`):

```sh
npm run seed
```

Then sign in at http://localhost:5173 as `demo@mensal.local` / `demo-password-local`. The demo user is already approved.

The seed creates recurrences (salary, rent, internet, an ended subscription, …) and occurrences in every state (settled, pending, overdue, skipped, one-off), with dates relative to the current month. It is meant for local development only: it refuses to run against a non-local database host or when `NODE_ENV=production`. Running it again resets the demo user's data to this baseline; other users are never touched.

## Checks

```sh
npm run check   # format, lint, boundaries, typecheck, tests
```

Tests need the Docker Postgres up (the `api` project runs against a real `mensal_test` database).
