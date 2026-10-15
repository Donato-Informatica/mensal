# PWA

Make the web app an installable PWA (phone first, including iOS; desktop too). Offline, it opens and shows the last known data, read-only. No offline writes, no sync queue.

## Decisions (from grilling)

- Production runs on HTTPS. The service worker is off in `vite dev`; verify with `vite build && vite preview`.
- Tooling: `vite-plugin-pwa`, `registerType: "prompt"`.
- The service worker precaches the built shell only. `/api/*` is network-only and never stored by it; the navigation fallback excludes `/api`.
- Update prompt in pt-BR ("Nova versão disponível" / "Atualizar"); never reloads on its own (dialogs can hold unsaved input).
- Manifest: name "Mensal", `lang: pt-BR`, `display: standalone`, theme and background colors from the DESIGN.md near-black canvas (not the yellow accent). Icons generated from `logo.svg` (192, 512, maskable; padded variant if the logo breaks the safe zone). iOS: apple-touch-icon, `apple-mobile-web-app-*` meta tags, safe-area insets.
- Offline data lives in the app layer, not the service worker: TanStack Query persistence into IndexedDB, per user, version buster, read queries only (periods, recurrences), never auth responses. Sign-out wipes it.
- Offline session: a network failure keeps the cached session and opens read-only; a real 401/403 (e.g. `USER_NOT_APPROVED`) behaves as today.
- Offline UX: persistent banner "Sem conexão — mostrando os últimos dados carregados"; every mutating control (incl. preference saves) visible but disabled with a pt-BR hint; detection = `navigator.onLine` + failed fetches; on reconnect controls re-enable and queries refetch.
- Only data opened before is available; a never-loaded month shows "indisponível offline". Show an "atualizado em …" timestamp; no expiry.
- Tests: `web` project simulates offline via network errors from the fake API; injectable persister (in-memory in tests, no new test dependency); no service-worker mocking. Installability and real IndexedDB are checked manually (`vite preview`, Lighthouse).
- Remove the `impeccable-live` script from `index.html` (local dev tooling must not ship).
- Docs: short `AGENTS.md` note, no ADR.
