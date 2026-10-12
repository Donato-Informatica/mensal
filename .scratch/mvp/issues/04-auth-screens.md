# 04: Sign up, sign in, wait for approval (web)

**What to build:** the web app where a person signs up and signs in; an unapproved user sees the "Aguardando aprovação" screen with a sign-out action, and an approved user lands on an (empty) authenticated home. Source: `docs/prd.md` §7.8, §8.1, §8.2.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] React + Vite + Mantine UI + TanStack Router + TanStack Query app, all UI text in pt-BR written directly in the components
- [x] In development the web app reaches the API same-origin through a `/api` proxy (no CORS)
- [x] Sign-up and sign-in screens; API error codes mapped to Portuguese messages
- [x] Unapproved users are routed to "Aguardando aprovação", which offers sign-out
- [x] Approved users reach an authenticated home; unauthenticated users are redirected to sign-in
- [x] The workspace passes the root format, lint, boundaries, typecheck and test checks

## Comments

- Implemented as `@mensal/web` (`apps/web`). Run it with `npm run -w @mensal/web dev` (Vite on 5173) next to `npm run -w @mensal/api dev`; Vite proxies `/api` to the API on 3000.
- Same origin in development means the API's `BETTER_AUTH_URL` must be the web origin, `http://localhost:5173` (now in `apps/api/.env.example`): Better-Auth rejects cookie-carrying POSTs whose `Origin` is not its base URL's origin, so an `.env` still pointing at `:3000` breaks sign-in/sign-out through the proxy with `INVALID_ORIGIN`.
- Routes (code-based TanStack Router): `/entrar`, `/cadastro`, `/aguardando-aprovacao`, `/`. Each sits in a guarded layout area (`anonymous`, `awaiting-approval`, `approved`); `redirectFor` in `src/access.ts` decides where a visitor who does not belong is sent. Unknown paths and load failures get pt-BR screens.
- The session lives in TanStack Query under `["session"]`, loaded by the guards and dropped by `useSessionChange` after sign-in, sign-up and sign-out. It is only refetched on a page load, so a newly approved user reloads the waiting screen (the screen says so).
- API error codes map to Portuguese in `src/api-error.ts` (`errorMessage`); unknown codes and network failures fall back to "Algo deu errado. Tente novamente."
- Tests run in a `web` Vitest project (jsdom): the error map, the access decision, and the whole app rendered with only `fetch` faked by `tests/fake-api.ts`, which mirrors Better-Auth's endpoints, shapes and error codes (checked against the real API through the proxy).
- The theme in `src/theme.ts` maps `DESIGN.md` onto Mantine: forced dark scheme, `#faff69` primary with black text, near-black canvas and card surfaces, Inter (self-hosted via `@fontsource-variable/inter`).
