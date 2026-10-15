# 02: Offline read-only mode

**What to build:** When the connection is lost, the app says so and becomes read-only. A persistent banner reads "Sem conexão — mostrando os últimos dados carregados", every mutating control (new, edit, settle, end, delete, and preference saves) stays visible but disabled with a pt-BR hint, and screens keep showing the last data already loaded in the open session. Connectivity is detected from both `navigator.onLine` and failed requests (the `online` event alone is unreliable). When a request succeeds again, the banner goes away, controls re-enable and queries refetch.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [ ] Losing the connection (browser offline or network-failed requests) shows the banner; a real server error answer does not count as offline
- [ ] All mutating controls, including preference saves, are disabled with a pt-BR hint while offline
- [ ] Already-loaded screens keep showing their data while offline
- [ ] Reconnecting removes the banner, re-enables controls and refetches
- [ ] `web` tests simulate offline through network errors from the fake API (banner, disabled controls, recovery)
- [ ] `npm run check` passes
