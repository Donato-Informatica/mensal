# mensal

<img src="apps/web/public/logo.svg" alt="mensal logo" width="96" height="96">

Minimalist monthly cash-flow tracker: forecast and settle a person's monthly income and expenses. Recurrences project their occurrences at read time (virtual occurrences, [ADR-0001](docs/adr/0001-virtual-occurrences.md)); the first mutation materializes one. See [docs/prd.md](docs/prd.md) for the spec and [GLOSSARY.md](GLOSSARY.md) for domain vocabulary.

## Features

The interface is Brazilian Portuguese only, amounts are always BRL, and the [guide](#user-guide) teaches each feature step by step.

- **Monthly screen:** one period at a time, with a summary bar (Sobra prevista, then Previsto and Realizado for Entradas and Saídas) and occurrences grouped as Atrasadas, Vencem hoje, A vencer no mês, and Liquidadas e puladas. On the current period, overdue occurrences of earlier periods are listed too.
- **Recurrences (Recorrências):** monthly commitments that give rise to one occurrence per period, with the due day clamped to the month's length. Installments are recurrences with an end period. A recurrence with persisted occurrences can only be ended, never deleted.
- **One-off occurrences (Avulsas):** anything that does not recur, such as annual bills.
- **Settle and skip (Liquidar, Pular):** one click, applied at once and rolled back on failure. An amount can stay "A definir" until it is known, and must be filled in before settling.
- **View and export:** the occurrences as a grouped list or a table (Lista, Tabela), and **Exportar CSV** for the period on screen.
- **Trend (Evolução):** charts and a table of the 3, 6 or 12 periods ending at the period on screen, with the accumulated left over.
- **Preferences (Configurações):** the summary bar, confirmations before status changes, theme (Escuro, Claro, Automático) and view. They belong to the account, so they follow the user across devices.
- **Installable app (PWA), online only:** installed from the browser's own UI. It opens without a connection but stays locked until the connection is back; no data is ever cached ([ADR-0006](docs/adr/0006-app-shell-service-worker-no-offline-data.md)).
- **Reminders (Lembretes):** one Web Push reminder a day, at 09:00 São Paulo, about pending occurrences due that day and those overdue, on each device where the user turned them on ([ADR-0009](docs/adr/0009-reminders-through-web-push-and-a-daily-job.md)). See [Trying reminders](#trying-reminders) and [Reminders (Web Push)](#reminders-web-push).
- **Calendar link (Link do calendário):** a secret, read-only iCalendar address of the user's pending occurrences, for their own calendar app ([ADR-0008](docs/adr/0008-reminders-through-a-subscribed-calendar-link.md)).
- **Agents:** access tokens (Tokens de acesso) let the user's own agents read and write their data through an MCP server ([ADR-0004](docs/adr/0004-remote-mcp-with-access-tokens.md)). See [API docs and MCP](#api-docs-and-mcp).
- **Account:** Alterar nome, Alterar senha, Esqueci a senha, Baixar meus dados, and Excluir conta, which erases everything at once ([ADR-0005](docs/adr/0005-immediate-hard-account-deletion.md)).
- **Approval:** sign-up is open, but an administrator releases each user before they can use the product.
- **For the operator:** an activity log, traces and logs in Grafana that never carry user data ([ADR-0007](docs/adr/0007-opentelemetry-through-a-collector.md)), and an OpenAPI description of the API.

Deliberately left out: periodicity other than monthly, balances, categories, multiple currencies, billing, offline data, and reminders by email or SMS (PRD §1.3).

## Layout

npm-workspaces monorepo — no build step, TypeScript source is consumed directly.

- `apps/api` — Express server on :3000, Better-Auth + Drizzle (`/api/v1`).
- `apps/web` — React + Mantine + Vite on :5173, with TanStack Router and Query; proxies `/api` to the API (same origin).
- `apps/guide` — the user guide, a static page served at `/guia/` (see [User guide](#user-guide)).
- `packages/database` — Drizzle schema and migrations (Postgres 17).
- `packages/shared` — shared domain types, Zod schemas and the period-resolution logic.
- `otel-collector` — the OpenTelemetry Collector image used in production.
- `docs` — the PRD, the architecture decisions (`docs/adr/`) and agent conventions (`docs/agents/`).

## Running locally

Prerequisites: Node >= 24, Docker.

```sh
npm install

docker compose up -d          # Postgres on :5432, Grafana on :3001

npm run -w @mensal/database migrate

npm run -w @mensal/api dev     # :3000
npm run -w @mensal/web dev     # :5173 — open this one
```

Sign-up is open, but the API rejects unapproved users. Approve a user by setting `users.approved = true` directly in the database (e.g. via Drizzle Studio: `npm run studio`, http://localhost:4983).

### Configuration

The API reads its settings from the environment. `npm run -w @mensal/api dev` loads `apps/api/.env.example` and then `apps/api/.env`, so nothing has to be copied: create `.env` only to override a value or turn on an optional feature. The web app needs no configuration; its only settings are the build-time variables of [Local telemetry](#local-telemetry) and of the production web image.

| Variable                      | Local development                                                | Production                                                                                             |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                | `postgres://mensal:mensal@localhost:5432/mensal`                 | Your Postgres. Pending migrations run when the API container starts.                                   |
| `BETTER_AUTH_URL`             | `http://localhost:5173` (the web app, not the API)               | The public `https://` origin of the web app. The API won't start on plain `http://`.                   |
| `BETTER_AUTH_SECRET`          | Any string; the `.env.example` value works                       | At least 32 random characters (`openssl rand -base64 32`). The API won't start with the example value. |
| `PORT`                        | `3000`                                                           | `3000`                                                                                                 |
| `RESEND_API_KEY`              | Leave unset: emails are printed to the API log                   | A Resend API key with sending access                                                                   |
| `EMAIL_FROM`                  | Leave unset                                                      | A sender on your verified domain, e.g. `Mensal <nao-responda@your-domain>`                             |
| `VAPID_PUBLIC_KEY`            | Leave unset: reminders are off                                   | Generated once, see [Reminders (Web Push)](#reminders-web-push)                                        |
| `VAPID_PRIVATE_KEY`           | Leave unset                                                      | The other half of that pair                                                                            |
| `VAPID_SUBJECT`               | Leave unset                                                      | A `mailto:` address push services can reach you at                                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Leave unset, or `http://localhost:4318` to see telemetry locally | Set by `docker-compose.prod.yml`                                                                       |
| `DEPLOYMENT_ENVIRONMENT`      | Leave unset (`local`)                                            | `production`, see [Telemetry: Grafana Cloud](#telemetry-grafana-cloud)                                 |
| `SEED_DEMO_DATA`              | Leave unset                                                      | Never in production; `true` only in [Preview Deployments](#preview-deployments)                        |

Set `RESEND_API_KEY` and `EMAIL_FROM` together or not at all: the API won't start with only one ([ADR-0003](docs/adr/0003-transactional-email-via-resend.md)). When both are unset, emails (password-reset links, the password-changed alert and the account-deleted notice) are printed to the API log, so you can open a reset link locally by copying it from the terminal. The startup line says which mode is active: `Email: Resend, from …` or `Email: console (no RESEND_API_KEY)`.

The three `VAPID_*` variables work the same way: all or none, or the API won't start.

To try real emails locally, put both variables in `apps/api/.env` and restart the API. Without a verified domain, Resend only delivers from `onboarding@resend.dev` to your own Resend account's address.

### Demo data (optional)

To explore the app with example data, seed the local database (run it after `migrate`):

```sh
npm run seed
```

Then sign in at http://localhost:5173 as `demo@mensal.local` / `demo-password-local`. The demo user is already approved.

The seed creates recurrences (salary, rent, internet, an ended subscription, …) and occurrences in every state (settled, pending, overdue, due today, skipped, "A definir", one-off), with dates relative to today and six months of history. It is meant for local development only: it refuses to run against a non-local database host or when `NODE_ENV=production`. Running it again resets the demo user's data to this baseline; other users are never touched.

Coolify preview deployments load the same data on boot when `SEED_DEMO_DATA=true`, set only in the Preview Deployments environment variables, never production's. That mode skips the local-host check but still refuses if the database has any user besides the demo one.

### Trying reminders

Reminders need VAPID keys and a production build: only that build registers the service worker, so they cannot be turned on from the dev server.

1. Generate a pair of keys:

   ```sh
   npx web-push generate-vapid-keys
   ```

2. Add them to `apps/api/.env`:

   ```sh
   VAPID_PUBLIC_KEY=<public key>
   VAPID_PRIVATE_KEY=<private key>
   VAPID_SUBJECT=mailto:you@your-domain
   ```

3. Stop both dev servers, then start the API trusting the preview's origin, and build and serve the web app:

   ```sh
   BETTER_AUTH_URL=http://localhost:4173 npm run -w @mensal/api dev
   ```

   ```sh
   npm run -w @mensal/web build
   npm run -w @mensal/web preview   # :4173 — open this one
   ```

   Better-Auth trusts only `BETTER_AUTH_URL`'s origin, so without the override every sign-in on :4173 fails with `INVALID_ORIGIN`. Don't serve the preview on :5173 instead: its service worker would stay registered on that origin and keep answering in place of the dev server.

4. Sign in at http://localhost:4173 (`localhost` counts as secure, so no HTTPS is needed), open the account menu → **Lembretes** → **Ativar neste dispositivo** and allow notifications. The device receives **Lembretes ativados** right away.

The daily reminder goes out from 09:00 São Paulo: the job runs when the API starts and every 5 minutes after that, at most once per user per day. To receive today's reminder again, delete your row from `reminder_sends` (`npm run studio`). A reminder is only sent when something is due today or overdue, which the demo data always has.

### Local telemetry

`docker compose up -d` also starts `grafana/otel-lgtm`: Grafana at http://localhost:3001 (no login), with a Collector on :4318.

- **API:** set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in `apps/api/.env` and restart it.
- **Browser:** start the web app with `VITE_OTLP_PATH=/otlp npm run -w @mensal/web dev`.

Browse traces in **Explore → Tempo** and logs in **Explore → Loki**; [Telemetry: Grafana Cloud](#telemetry-grafana-cloud) lists useful queries.

## API docs and MCP

With the API running, these work on the web app's origin, locally and in production:

- `/api/docs` — the API reference (Scalar), where you can try the endpoints once signed in.
- `/api/openapi.json` — the OpenAPI 3.1 description, to import into Postman or similar.
- `/api/mcp` — the MCP server (stateless Streamable HTTP), authenticated by `Authorization: Bearer <access token>`.

To connect an agent, create a token in the app under **Tokens de acesso** (the app shows it once, with ready-to-copy snippets), then add the server. For Claude Code:

```sh
claude mcp add --transport http mensal http://localhost:5173/api/mcp --header "Authorization: Bearer <token>"
```

For Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.mensal]
url = "http://localhost:5173/api/mcp"
http_headers = { Authorization = "Bearer <token>" }
```

Any MCP client that can send that header works; OAuth (claude.ai custom connectors) is not supported. Each token can read and write everything its owner can, up to 120 requests per minute. Agents cannot manage tokens, the calendar link, reminders, preferences or the account.

## User guide

The app links to a pt-BR guide at `/guia/` (PRD §7.17): one page with a section per feature (what it is for, then how to use it, step by step), with screenshots of the demo data. It is plain HTML and CSS in `apps/guide`, built by Vite and served by the web image's nginx beside the app.

```sh
npm run -w @mensal/guide dev   # :5174, open http://localhost:5174/guia/
```

With the guide's dev server also running, `http://localhost:5173/guia/` and the app's links into the guide work as in production. No client route may start with `/guia`.

The screenshots in `apps/guide/screenshots/` are taken from the local stack with the demo seed. With the stack running (`docker compose up -d`, then the API and web dev servers, as in [Running locally](#running-locally)), the VAPID keys of [Trying reminders](#trying-reminders) in `apps/api/.env` (the `lembretes` shot needs them) and Playwright's browser installed once (`npx playwright install chromium`):

```sh
npm run -w @mensal/guide screenshots
```

It re-runs `npm run seed`, signs in as the demo user and rewrites every screenshot declared in `apps/guide/scripts/captures.ts`. It is manual only: never run by `npm run check`.

**When you change a feature of PRD §7, update its section of the guide and redo the screenshots** in the same change.

## Deploying to production

The production stack is [docker-compose.prod.yml](docker-compose.prod.yml), meant for [Coolify](https://coolify.io) (PRD §8.4): Postgres, the API, the OpenTelemetry Collector and the web app (nginx serving the static build and forwarding `/api` to the API, so the browser sees one origin). Only `web` is public.

1. **Resend** (optional, but without it password-reset links only reach the container log):
   1. In Resend, add your domain under **Domains** and create the DNS records it lists (SPF, DKIM) at your DNS provider. Wait until the domain shows as verified.
   2. Create an API key under **API Keys** with **Sending access**, restricted to that domain.
2. **Coolify:** create a new resource → **Docker Compose**, pointing at this repository with compose file `/docker-compose.prod.yml`.
3. Set the domain of the `web` service (e.g. `https://mensal.example`). Coolify fills `SERVICE_URL_WEB` with it, which becomes `BETTER_AUTH_URL` and the web build argument `VITE_PUBLIC_ORIGIN` (the guide's link previews need an absolute image URL; without it, previews show no image). It also generates the Postgres password and `BETTER_AUTH_SECRET` once and keeps them.
4. Under the resource's environment variables, set `RESEND_API_KEY` and `EMAIL_FROM` (step 1), or leave both empty. To send reminders, also set the `VAPID_*` variables of [Reminders (Web Push)](#reminders-web-push), or leave all three empty.
5. Deploy. The API applies pending migrations before it starts, and refuses to boot on a guessable secret, a plain-`http` origin, only one of the two Resend variables, or only some of the `VAPID_*` variables; check its log if the healthcheck fails. A healthy start logs `Email: Resend, from …` and `Reminders: Web Push, signed with the VAPID keys`.
6. Check email end to end: sign up, use **Esqueci a senha** with that address, and confirm the reset email arrives. Then approve your user by setting `users.approved = true` in the database.

Also set up daily Postgres backups in Coolify to S3-compatible storage outside the VPS, with 30-day retention (PRD §8.4).

The installable app needs no setup of its own: the web image already serves `sw.js`, `registerSW.js` and `manifest.webmanifest` with `Cache-Control: no-cache`, so a new version is picked up on the next open.

### Reminders (Web Push)

Mensal sends reminders itself, by Web Push, to the browser or installed app of each device where the user turned them on (PRD §6.8, [ADR-0009](docs/adr/0009-reminders-through-web-push-and-a-daily-job.md)). This takes no third-party account and no extra service: a job inside the API process signs with the server's own VAPID keys and sends through each browser's push service. Without the keys everything else works, and the Lembretes screen says "Os lembretes não estão disponíveis neste servidor."

1. Generate the keys once, from a checkout of this repository:

   ```sh
   npx web-push generate-vapid-keys
   ```

   Keep them with your other secrets. **Don't regenerate them later:** new keys silently invalidate every device's registration. The screen would still show Ativado on those devices, the push services would refuse every send, and each user would have to turn reminders off and on again on each device.

2. In Coolify, set these on the resource. Leave them out of the **Preview Deployments** environment variables, so previews run with reminders off:

   | Variable            | Value                                                                        |
   | ------------------- | ---------------------------------------------------------------------------- |
   | `VAPID_PUBLIC_KEY`  | the public key                                                               |
   | `VAPID_PRIVATE_KEY` | the private key                                                              |
   | `VAPID_SUBJECT`     | a `mailto:` address push services can reach you at, e.g. `mailto:you@domain` |

3. If Coolify's copy of the compose file predates reminders, use **Reload Compose File** first, or the variables never reach the container. Then redeploy. Only the API reads them: browsers get the public key from `GET /api/v1/reminders`, so there is no web build argument to set.
4. Check the `api` log. `Reminders: Web Push, signed with the VAPID keys` means they arrived; `Reminders: off (no VAPID_PUBLIC_KEY)` means they did not. The API checks only that all three are present, not that they are valid, so the next step is the real test.
5. Check it end to end: in the deployed app, open the account menu → **Lembretes** → **Ativar neste dispositivo** and allow notifications. The device receives **Lembretes ativados** within seconds. If it doesn't, look for `Reminders confirmation failed` in the `api` log.

On phones, reminders work from the browser on Android. On iPhone and iPad they work only from the app added to the home screen (iOS 16.4 or later); in Safari the screen shows Indisponível. The guide explains this to users at `/guia/#lembretes`.

What to expect in operation:

- **Network:** the API container needs outbound HTTPS to the browsers' push services (Google's, Mozilla's and Apple's). The app must be on `https://`, which production already enforces.
- **Schedule:** the job runs when the API starts and every 5 minutes after that, and handles users from 09:00 São Paulo on. A run missed while the API was down is caught up later the same day, never the next. Replicas and restarts never send twice.
- **At most once:** a failed send is logged and not retried, so that user misses that day's reminder. A device that its push service reports as gone (`404`, `410`) is deleted.
- **Logs:** each run that finds someone to handle writes `Reminders: <n> users reminded, <n> devices sent, <n> failed, <n> dropped`, in the container log and Grafana. Most runs find nobody and write nothing. The log never holds push endpoints or reminder text.
- **Lock screens:** a reminder names occurrences by description only, never amounts or notes.

### Telemetry: Grafana Cloud

Traces and logs go from the API and the browser to the `otel-collector` service ([otel-collector/config.yaml](otel-collector/config.yaml)), which redacts them and exports to Grafana Cloud's free tier (PRD §8.7, [ADR-0007](docs/adr/0007-opentelemetry-through-a-collector.md)). The browser posts to `/otlp` on the app's own origin and nginx forwards it (60 requests per minute per client IP, bodies up to 256 kB). The Collector being down never affects the app or `/api/health`.

1. In [Grafana Cloud](https://grafana.com) create a free stack. Under the stack's **OpenTelemetry** tile, generate an API token and note the **OTLP endpoint** (e.g. `https://otlp-gateway-prod-us-east-0.grafana.net/otlp`) and the **Instance ID**.
2. In Coolify, set these on the resource (and in its **Preview Deployments** environment variables; previews share production's stack):

   | Variable                      | Value                                                                                  |
   | ----------------------------- | -------------------------------------------------------------------------------------- |
   | `GRAFANA_CLOUD_OTLP_ENDPOINT` | the OTLP endpoint above                                                                |
   | `GRAFANA_CLOUD_INSTANCE_ID`   | the numeric instance id                                                                |
   | `GRAFANA_CLOUD_API_TOKEN`     | the token                                                                              |
   | `DEPLOYMENT_ENVIRONMENT`      | `production` for production; `pr-<n>` (or `preview`) in Preview Deployments, see below |

   None has a default in the compose file on purpose: Coolify would otherwise bake production's value into every preview. The web build reads `DEPLOYMENT_ENVIRONMENT` as a build argument, so redeploy after changing it.

3. Coolify reads the compose file from `main`, not from the PR: after merging a change to `docker-compose.prod.yml` (including the first one adding the Collector), open the resource and use **Reload Compose File**, then redeploy. Until then previews keep the old stack.

Coolify exposes no pull request number to compose files, so `DEPLOYMENT_ENVIRONMENT` in the Preview Deployments variables is one fixed value for every preview. Use `preview` there, or change it to `pr-<n>` when you are looking at a specific preview.

In Grafana, open **Explore** and pick the Loki (logs) or Tempo (traces) data source. Filter by environment first (`deployment_environment` in Loki, `resource.deployment.environment` in Tempo):

- **Activity log of one user** (Loki): `{service_name="mensal-api", deployment_environment="production"} | action != "" | user = "<user id>"`. Add `| action = "occurrence.status"` to narrow it to one action.
- **Slow traces** (Tempo, TraceQL): `{ resource.service.name = "mensal-api" && duration > 1s }`. Open one to see the browser span, the API request and the SQL under it.
- **500s** (Tempo): `{ resource.service.name = "mensal-api" && span.http.status_code >= 500 }`; for the logs of the same failures, `{service_name="mensal-api"} | detected_level = "error"` in Loki.
- **Browser errors** (Loki): `{service_name="mensal-web"} | detected_level = "error"`.

Attribute names follow Grafana's OTLP mapping; if a label or field is missing, use the query builder's label browser to see what the stack calls it.

### Preview deployments

Previews run production's compose file with their own database, configured from the **Preview Deployments** environment variables:

- **`SEED_DEMO_DATA`:** `true` to load the [demo data](#demo-data-optional) on boot. Never set it in production's variables.
- **`DEPLOYMENT_ENVIRONMENT` and the `GRAFANA_CLOUD_*` variables:** as in [Telemetry: Grafana Cloud](#telemetry-grafana-cloud).
- **`VAPID_*`:** leave unset, so reminders stay off.
- **`RESEND_API_KEY` and `EMAIL_FROM`:** the compose file gives them a default, so previews get production's values unless you clear them here.

The variables that must differ in a preview have no `:-default` in the compose file on purpose: Coolify would bake production's value into the preview. A change to `docker-compose.prod.yml` reaches previews only after it is merged to `main` and you use **Reload Compose File**.

## Checks

```sh
npm run check   # format:check, lint, lint:boundaries, typecheck, test
```

Tests need the Docker Postgres up (the `api` project runs against a real `mensal_test` database). Vitest runs three projects: `unit`, `api` (the real Express app against Postgres, no mocks) and `web` (the app in jsdom, with only the network faked). Run one file with `npx vitest run <path>` or one project with `npx vitest run --project <name>` — only `*.test.*` files under a workspace's `tests/` folder are picked up.

There is no CI: this and the pre-commit hook are the only gates. The hook runs the same suite (Prettier on staged files instead of `format:check`) and also rejects staged `apps/` changes that add an `impeccable-live` block, a dev-only script that must never be committed.

## Contributing

- `docs/prd.md` is the spec; code and comments cite it as "PRD §x.y". [GLOSSARY.md](GLOSSARY.md) fixes the domain vocabulary (with its pt-BR UI strings), [DESIGN.md](DESIGN.md) is the UI theme source, [PRODUCT.md](PRODUCT.md) the product intent, and [docs/adr/](docs/adr/) the architecture decisions.
- Migrations and the Better-Auth schema are generated (`npm run -w @mensal/database generate`, `npm run -w @mensal/api auth:generate`) — never hand-edit `packages/database/migrations/` or `packages/database/lib/schema/auth.ts`.
- `packages/*` are deep modules: import only a package's entry points, never paths into it ([packages/README.md](packages/README.md)). `npm run lint:boundaries` enforces this.
- A new `/api/v1` route needs an entry in `apps/api/src/openapi.ts` and an MCP tool in `apps/api/src/mcp-*-tools.ts`, or tests fail. Only `/me`, `/access-tokens`, `/calendar-link`, `/reminders` and `/data` are exempt from the tool.
- Telemetry must never carry user data (PRD §8.7.2); `apps/api/tests/telemetry-privacy.test.ts` guards it.
- Issues live in GitHub Issues on `Donato-Informatica/mensal`. Working conventions for agents (issue tracker, triage labels, domain docs) are in [docs/agents/](docs/agents/).
