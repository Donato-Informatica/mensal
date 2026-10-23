# The app is installable, but its service worker caches only the shell

Mensal is installable as a PWA (PRD §7.16) yet does not work offline: its service worker (`vite-plugin-pwa`, Workbox `generateSW`) precaches only the built app shell and never anything under `/api`, and while the browser is offline the app shows a "Sem conexão" banner and locks itself. We rejected a manifest without a service worker because an installed app opened offline would then show the browser's error page instead of our banner. We rejected offline data (cached reads, queued writes) because the monthly figures would silently go stale, writes made offline would need conflict handling against virtual occurrences (ADR-0001) materialized elsewhere, and the cached data of a shared device would outlive sign-out.

## Consequences

- A service worker outlives the code that registered it: removing it later means shipping a self-unregistering worker, not deleting the plugin.
- New versions take over silently (`skipWaiting` / `clientsClaim`, no reload), so an open tab can run an older shell against a newer API until it is reopened. API changes must keep tolerating the previous web build for that window.
- `sw.js`, `registerSW.js` and `manifest.webmanifest` must never be cached by nginx, or clients get stuck on an old version.
