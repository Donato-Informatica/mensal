# AGENTS.md

Mensal: forecast and settle a person's monthly cash flow. npm-workspaces monorepo (no Turborepo/Nx, no build step — workspaces are consumed as TypeScript source).

- `docs/prd.md` is the spec. Code, tickets and comments cite it as "PRD §x.y"; honor those references.
- `GLOSSARY.md` fixes domain vocabulary. Use its terms and their pt-BR UI strings; code, data and docs stay English.
- `DESIGN.md` is the UI theme source (near-black canvas, electric yellow `#faff69`, Inter), mapped onto Mantine in `apps/web/src/theme.ts`.
- Icons come from `@tabler/icons-react` (18px, `aria-hidden`); don't hand-write inline SVGs.

## Commands

- `npm run check` — the full gate: `format:check`, `lint`, `lint:boundaries`, `typecheck`, `test`. The pre-commit hook runs the same suite (prettier on staged files instead of `format:check`).
- Single test file: `npx vitest run <path>`. Single suite: `npx vitest run --project unit|api|web`. Only `*.test.{ts,tsx}` under a workspace's `tests/` folder are ever picked up; tests anywhere else silently never run.
- Local stack: `docker compose up -d` first (Postgres 17; fresh databases need `npm run -w @mensal/database migrate`; browse/edit data with `npm run studio` → Drizzle Studio on :4983). Then `npm run -w @mensal/api dev` (:3000, needs `apps/api/.env` copied from `.env.example`) and `npm run -w @mensal/web dev` (:5173, proxies `/api` to :3000 — same origin, no CORS).
- Guide (PRD §7.17, §8.4): the workspace `apps/guide` is the static page at `/guia/`: plain HTML and CSS (no React, Mantine or app JS), styled from `DESIGN.md`'s tokens, built by Vite with `base: "/guia/"`. Preview it with `npm run -w @mensal/guide dev` (:5174, at `/guia/`); the web dev server forwards `/guia` there, so with both running `http://localhost:5173/guia/` and the app's links into the guide work as in production. Its section ids are the exported list in `apps/guide/index.ts`, imported by name (`@mensal/guide`) for links into the guide; `apps/guide/tests/page.test.ts` fails if a section, anchor or image goes missing. The web Dockerfile builds it into `/usr/share/nginx/html/guia`; nginx serves it before the SPA fallback and the service worker leaves `/guia` to the network (`apps/web/src/pwa-navigation.ts`). No SPA route may start with `/guia`. Link previews need an absolute `og:image`: the build prefixes it (and adds `og:url`) with `VITE_PUBLIC_ORIGIN`, the public origin, a web Docker build arg that `docker-compose.prod.yml` fills from `SERVICE_URL_WEB`; unset (local builds), `og:image` stays root-relative, there is no `og:url`, and only link previews lose the image (`apps/guide/tests/build.test.ts`).
- Guide screenshots: `npm run -w @mensal/guide screenshots` (manual only; never in `check` or CI). Prerequisites: the local stack up (`docker compose up -d`, then the API and web dev servers, as in "Local stack") and Playwright's browser installed once (`npx playwright install chromium`). It re-runs the demo seed, signs in as the demo user and writes `apps/guide/screenshots/<name>.png` (2x; dark, light only for Configurações). The shots are declared in `apps/guide/scripts/captures.ts` (name, route and steps, viewport, theme); any access token created is replaced by a fake value before a capture. **Changed a feature of PRD §7? Update its guide section and redo the screenshots.**
- Browser telemetry (PRD §8.7.3): off unless the web build sets `VITE_OTLP_PATH=/otlp` (e.g. `VITE_OTLP_PATH=/otlp npm run -w @mensal/web dev`; the Vite dev server proxies `/otlp` to otel-lgtm on :4318, stripping the prefix, as nginx must). `VITE_DEPLOYMENT_ENVIRONMENT` sets `deployment.environment` (default `local` in dev, `production` otherwise; both are also Docker build args). `apps/web/src/telemetry.ts` is the only entry and loads the SDK chunk (`telemetry-sdk.ts`) lazily; `openApp()` tests never start it. Only the app's own `/api` is traced and gets `traceparent`; keep it that way (`telemetry-rules.ts`).
- Telemetry (PRD §8.7, [ADR-0007](docs/adr/0007-opentelemetry-through-a-collector.md)): `docker compose up -d` also starts `grafana/otel-lgtm`; browse traces (Explore → Tempo) and logs (Explore → Loki) at `http://localhost:3001` (no login). It is off until you uncomment `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in `apps/api/.env`. `apps/api/src/instrumentation.ts` is loaded with `node --import` before `server.ts` (the `dev` and `start` scripts, the Dockerfile `CMD`), never from vitest or app code; it does nothing without that variable. The default `consoleActivity` sink and `exportedLog` (`apps/api/src/log.ts`) write to stdout as before and also emit OTel log records linked to the active span; the email text printed without Resend stays on stdout only (`consoleEmail` is never given an exporting log). Telemetry must never carry user data (PRD §8.7.2): `apps/api/tests/telemetry-privacy.test.ts` guards spans and logs.
- API docs: with the API running, `http://localhost:5173/api/docs` (try the endpoints) and `/api/openapi.json` (import into Postman). A new `/api/v1` route needs an entry in `apps/api/src/openapi.ts`, or `openapi.test.ts` fails (PRD §8.8). It also needs an MCP tool (`apps/api/src/mcp-*-tools.ts`, naming the route in its `operation`), or the coverage guard in `mcp-write.test.ts` fails (PRD §8.9); only `/me`, `/access-tokens` and `/data` are exempt.
- MCP server (PRD §8.9, [ADR-0004](docs/adr/0004-remote-mcp-with-access-tokens.md)): `POST /api/mcp` (stateless Streamable HTTP; locally `http://localhost:5173/api/mcp`), authenticated by `Authorization: Bearer <access token>` (create one in the app; the token is shown once). Connect Claude Code with `claude mcp add --transport http mensal http://localhost:5173/api/mcp --header "Authorization: Bearer <token>"`, or Codex with `url = "http://localhost:5173/api/mcp"` and `http_headers = { Authorization = "Bearer <token>" }` under `[mcp_servers.mensal]` in `~/.codex/config.toml`. A tool is a `defineTool` in `apps/api/src/mcp-tool.ts` terms, listed in `apps/api/src/mcp-tools.ts`; it runs a shared operation from `operations.ts`.
- Cloud sessions (`CLAUDE_CODE_REMOTE=true`): a SessionStart hook runs `scripts/cloud-session-start.sh`, which installs Node 24 and dependencies, starts the compose Postgres and migrates it. Its log is `/tmp/mensal-cloud-setup.log`.
- Demo data: `npm run seed` (local database only; refuses non-local hosts) recreates `demo@mensal.local` / `demo-password-local` with example recurrences and occurrences, relative to today: on any day of the month the current period has every group of the monthly screen, a skipped and an "A definir" occurrence, and six months of history (the guide's scenario, guarded by `apps/api/tests/seed.test.ts`). Re-running resets that user.

## Testing

Three vitest projects (`vitest.config.ts`):

- `unit` — everything except the two below, including `apps/api/tests/unit/`.
- `api` — every other test under `apps/api/tests/`: the real Express app against real Postgres, no database mocks. An API test that needs neither the app nor the database (e.g. `readConfig`) goes in `apps/api/tests/unit/` instead. `apps/api/tests/global-setup.ts` creates and migrates `mensal_test` (override via `TEST_DATABASE_URL`) and truncates users; development data is never touched. If Postgres is down it fails telling you to run `docker compose up -d`.
- `web` — jsdom; the whole app rendered via `openApp()` against `apps/web/tests/fake-api.ts`, an in-memory stand-in for Better-Auth and `/api/v1` built on the real `resolvePeriod`. Only the network is faked: don't mock domain logic or reach for MSW.

## Architecture

- **Virtual occurrences** ([ADR-0001](docs/adr/0001-virtual-occurrences.md)): a recurrence's occurrences are projected at read time, never pre-created. The first mutation materializes one via an idempotent upsert on `(user_id, recurrence_id, period)`; untouched virtuals always reflect the recurrence as it is now. Virtual ids look like `virtual_<recurrenceId>_<period>`.
- **Deep modules**: each `packages/*` exposes only its root files (`index.ts`, …); `lib/` and `tests/` are private. Import packages by name (`@mensal/shared`), never by path. `npm run lint:boundaries` (dependency-cruiser) enforces this and runs in `check` and on commit. Read [packages/README.md](packages/README.md) before adding or importing a package.
- **Migrations**: only `npm run -w @mensal/database generate` writes them (drizzle-kit; never hand-edit `packages/database/migrations/`). drizzle-kit is the only migration system — `auth migrate` is never used.
- **Better-Auth schema** is generated into `packages/database/lib/schema/auth.ts` by `npm run -w @mensal/api auth:generate`. Never add `--adapter`: the CLI then emits singular tables and breaks `usePlural: true`.
- **Approval gate**: sign-up is open, but `/api/v1` rejects unapproved users with `403 USER_NOT_APPROVED`. Approval is an administrator setting `users.approved = true` directly in the database.
- **Email** ([ADR-0003](docs/adr/0003-transactional-email-via-resend.md)): password emails go through Better-Auth's injectable `email` sink: Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set, otherwise printed to the server log. API tests inject a capturing sink; nothing ever calls Resend in tests.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Donato-Informatica/mensal` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Packages

Packages are deep modules: see [packages/README.md](./packages/README.md) before adding or importing one.
