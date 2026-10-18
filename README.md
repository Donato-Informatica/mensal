# mensal

<img src="apps/web/public/logo.svg" alt="mensal logo" width="96" height="96">

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

docker compose up -d          # Postgres on :5432

cp apps/api/.env.example apps/api/.env   # see Configuration below

npm run -w @mensal/database migrate

npm run -w @mensal/api dev     # :3000
npm run -w @mensal/web dev     # :5173 — open this one
```

Sign-up is open, but the API rejects unapproved users. Approve a user by setting `users.approved = true` directly in the database (e.g. via Drizzle Studio: `npm run studio`, http://localhost:4983).

### Configuration

The API reads its settings from the environment. `npm run -w @mensal/api dev` loads `apps/api/.env.example` and then `apps/api/.env`, so a value in `.env` wins; the web app needs no configuration.

| Variable             | Local development                                  | Production                                                                                             |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`       | `postgres://mensal:mensal@localhost:5432/mensal`   | Your Postgres. Pending migrations run when the API container starts.                                   |
| `BETTER_AUTH_URL`    | `http://localhost:5173` (the web app, not the API) | The public `https://` origin of the web app. The API won't start on plain `http://`.                   |
| `BETTER_AUTH_SECRET` | Any string; the `.env.example` value works         | At least 32 random characters (`openssl rand -base64 32`). The API won't start with the example value. |
| `PORT`               | `3000`                                             | `3000`                                                                                                 |
| `RESEND_API_KEY`     | Leave unset: emails are printed to the API log     | A Resend API key with sending access                                                                   |
| `EMAIL_FROM`         | Leave unset                                        | A sender on your verified domain, e.g. `Mensal <nao-responda@your-domain>`                             |

Set `RESEND_API_KEY` and `EMAIL_FROM` together or not at all: the API won't start with only one ([ADR-0003](docs/adr/0003-transactional-email-via-resend.md)). When both are unset, emails (password-reset links and the password-changed alert) are printed to the API log, so you can open a reset link locally by copying it from the terminal. The startup line says which mode is active: `Email: Resend, from …` or `Email: console (no RESEND_API_KEY)`.

To try real emails locally, put both variables in `apps/api/.env` and restart the API. Without a verified domain, Resend only delivers from `onboarding@resend.dev` to your own Resend account's address.

### Demo data (optional)

To explore the app with example data, seed the local database (run it after `migrate`):

```sh
npm run seed
```

Then sign in at http://localhost:5173 as `demo@mensal.local` / `demo-password-local`. The demo user is already approved.

The seed creates recurrences (salary, rent, internet, an ended subscription, …) and occurrences in every state (settled, pending, overdue, skipped, one-off), with dates relative to the current month. It is meant for local development only: it refuses to run against a non-local database host or when `NODE_ENV=production`. Running it again resets the demo user's data to this baseline; other users are never touched.

Coolify preview deployments load the same data on boot when `SEED_DEMO_DATA=true`, set only in the Preview Deployments environment variables, never production's. That mode skips the local-host check but still refuses if the database has any user besides the demo one.

## Deploying to production

The production stack is [docker-compose.prod.yml](docker-compose.prod.yml), meant for [Coolify](https://coolify.io) (PRD §8.4): Postgres, the API, and the web app (nginx serving the static build and forwarding `/api` to the API, so the browser sees one origin). Only `web` is public.

1. **Resend** (optional, but without it password-reset links only reach the container log):
   1. In Resend, add your domain under **Domains** and create the DNS records it lists (SPF, DKIM) at your DNS provider. Wait until the domain shows as verified.
   2. Create an API key under **API Keys** with **Sending access**, restricted to that domain.
2. **Coolify:** create a new resource → **Docker Compose**, pointing at this repository with compose file `/docker-compose.prod.yml`.
3. Set the domain of the `web` service (e.g. `https://mensal.example`). Coolify fills `SERVICE_URL_WEB` with it, which becomes `BETTER_AUTH_URL`. It also generates the Postgres password and `BETTER_AUTH_SECRET` once and keeps them.
4. Under the resource's environment variables, set `RESEND_API_KEY` and `EMAIL_FROM` (step 1), or leave both empty.
5. Deploy. The API applies pending migrations before it starts, and refuses to boot on a guessable secret, a plain-`http` origin, or only one of the two Resend variables; check its log if the healthcheck fails. A healthy start logs `Email: Resend, from …`.
6. Check email end to end: sign up, use **Esqueci a senha** with that address, and confirm the reset email arrives. Then approve your user by setting `users.approved = true` in the database.

Also set up daily Postgres backups in Coolify to S3-compatible storage outside the VPS (PRD §8.4).

## Checks

```sh
npm run check   # format:check, lint, lint:boundaries, typecheck, test
```

Tests need the Docker Postgres up (the `api` project runs against a real `mensal_test` database). Vitest runs three projects: `unit`, `api` (the real Express app against Postgres, no mocks) and `web` (the app in jsdom, with only the network faked). Run one file with `npx vitest run <path>` or one project with `npx vitest run --project <name>` — only `*.test.*` files under a workspace's `tests/` folder are picked up.

A pre-commit hook runs the same suite (Prettier on staged files instead of `format:check`).

## Contributing

- `docs/prd.md` is the spec; code and comments cite it as "PRD §x.y". [GLOSSARY.md](GLOSSARY.md) fixes the domain vocabulary (with its pt-BR UI strings), [DESIGN.md](DESIGN.md) is the UI theme source, [PRODUCT.md](PRODUCT.md) the product intent, and [docs/adr/](docs/adr/) the architecture decisions.
- Migrations and the Better-Auth schema are generated (`npm run -w @mensal/database generate`, `npm run -w @mensal/api auth:generate`) — never hand-edit `packages/database/migrations/` or `packages/database/lib/schema/auth.ts`.
- `packages/*` are deep modules: import only a package's entry points, never paths into it ([packages/README.md](packages/README.md)). `npm run lint:boundaries` enforces this.
- Working conventions for agents (issue tracker as local markdown, triage labels, domain docs) are in [docs/agents/](docs/agents/).
