# 01: Installable shell

**What to build:** The built app can be installed on a phone (Android and iOS home screen) and on desktop as "Mensal": standalone window, pt-BR, near-black theme colors from DESIGN.md, icons generated from the logo (including a maskable one), iOS meta tags, and safe-area insets so the layout clears notches and home indicators. A service worker precaches the built shell only and never touches `/api` (network-only, navigation fallback excludes `/api`). When a new version is deployed, a pt-BR prompt ("Nova versão disponível" / "Atualizar") lets the user choose when to update; the app never reloads on its own. The service worker is off in `vite dev`. Remove the local-only `impeccable-live` script from the page. Add a short note to `AGENTS.md` (the PWA exists, `/api` is never cached by the service worker, how to verify).

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [ ] `vite build` emits a valid manifest and the icon set (192, 512, maskable); a build-output test asserts this
- [ ] The logo works as a maskable icon (padded variant added if it breaks the safe zone)
- [ ] The service worker precaches shell assets only; `/api/*` requests are never cached and the navigation fallback excludes `/api`
- [ ] A deployed update shows the pt-BR prompt and updates only when the user accepts; no automatic reload
- [ ] The update prompt has a `web` test; no service-worker mocking
- [ ] The `impeccable-live` script block is gone from `index.html`
- [ ] Manually verified with `vite build && vite preview` (installable per Lighthouse/devtools, iOS meta tags present)
- [ ] `AGENTS.md` has the short PWA note
- [ ] `npm run check` passes
