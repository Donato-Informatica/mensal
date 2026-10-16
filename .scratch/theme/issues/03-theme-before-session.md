# 03: Theme before the session is known

**What to build:** no flash of the wrong theme. On first paint, and on the signed-out screens (Entrar, Cadastro, password reset), each device uses the last scheme it applied, or Escuro if it has none (PRD §3.5). Once the session loads, the account's `colorScheme` wins and replaces the device's copy. The browser chrome follows the applied scheme.

**Blocked by:** 02

**Status:** resolved

- [x] The device keeps the last applied scheme (`"dark" | "light" | "auto"`) in `localStorage`, e.g. Mantine's `localStorageColorSchemeManager`. It is a cache only: never read as the account's value once a session exists, and never sent at sign-up.
- [x] First paint uses that cache before React renders (Mantine's `ColorSchemeScript` or an equivalent inline script in `index.html`), with Escuro when it is missing or invalid.
- [x] Signing out leaves the cache as it was, so the auth screens keep the last theme. A different user signing in on the same device gets their own `colorScheme` as soon as the session loads.
- [x] `<meta name="color-scheme">` in `index.html` and a `<meta name="theme-color">` (canvas colour of the applied scheme) follow the applied scheme, including Automático's live changes.
- [x] Web tests: with a cached `"light"` and no session, the sign-in screen renders light. With a cached `"light"` and an account on `"dark"`, the app ends dark and the cache becomes `"dark"`. A garbage cache value falls back to dark.
- [x] `npm run check` green.

## Comments

- Resolved on branch `theme` (2026-10-15) in 9015e01, 3c8c445; code-review fixes in cee312d (a signed-in tab ignores other tabs' cache writes), d31c836. Cache key is `mensal-color-scheme`.
