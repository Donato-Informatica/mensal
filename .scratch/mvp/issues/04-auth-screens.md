# 04: Sign up, sign in, wait for approval (web)

**What to build:** the web app where a person signs up and signs in; an unapproved user sees the "Aguardando aprovação" screen with a sign-out action, and an approved user lands on an (empty) authenticated home. Source: `docs/prd.md` §7.8, §8.1, §8.2.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] React + Vite + Mantine UI + TanStack Router + TanStack Query app, all UI text in pt-BR written directly in the components
- [ ] In development the web app reaches the API same-origin through a `/api` proxy (no CORS)
- [ ] Sign-up and sign-in screens; API error codes mapped to Portuguese messages
- [ ] Unapproved users are routed to "Aguardando aprovação", which offers sign-out
- [ ] Approved users reach an authenticated home; unauthenticated users are redirected to sign-in
- [ ] The workspace passes the root format, lint, boundaries, typecheck and test checks
