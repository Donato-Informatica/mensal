# 01: Scheme-aware colours

**What to build:** every colour in the web app resolves by role per colour scheme, using DESIGN.md's tokens and their `light-` counterparts (Colors › Light scheme). The app still forces dark, so nothing visible changes yet. This makes ticket 02's switch to light a matter of letting the scheme change.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `apps/web/src/theme.ts`: map the light tokens onto Mantine's light scheme, and give every role the code needs a scheme-resolved CSS variable (`cssVariablesResolver`'s `light` / `dark` sections, e.g. ink, surface-card, hairline, hairline-strong, muted, inflow, needs-you edge). Light-scheme focus ring and anchors take ink, not yellow.
- [x] Replace fixed palette shades with those roles everywhere they are used as a role: `c="white"`, `bg="dark.6"` / `"dark.7"`, `color="dark.6"`, `var(--mantine-color-dark-N)`, `var(--mantine-color-white)`, `c="yellow"` on the wordmark and stacked lockup, `"yellow.4"` / `yellow-9` on the needs-you groups, `"green.5"` on inflow amounts, and the `rgb(239 68 68 / 0.1)` tint in `occurrence-row.module.css`. Files today: `month.tsx`, `recurrences.tsx`, `card-screen.tsx`, `wordmark.tsx`, `app-layout.tsx`, `flip.ts`, the confirming dialogs (`delete-*`, `end-recurrence`, `status-controls`, `undo-toast`), `theme.ts` (`Title`), and the CSS modules `app-layout`, `dialog`, `occurrence-row`, `settings`, `undo-toast`.
- [x] Needs-you groups in light: the label is ink on a yellow fill (2px × 6px, `xs` radius) and the panel edge is ink. Controls with a yellow fill (checked settle box, switch track) get a 1px ink border in light.
- [x] The undo toast's shadow is checked in light; keep it only if it still reads as an interruption, per DESIGN.md Elevation.
- [ ] Dark looks identical to before (compare the month, recurrences, auth and Configurações screens at 375px and desktop).
- [ ] Temporarily dropping `forceColorScheme` to `"light"` locally shows a coherent light app on every screen, with no white-on-white text or invisible yellow. Not committed.
- [x] `npm run check` green.

## Comments

- Light tokens and the Fill-Only Rule in DESIGN.md approved by the user (2026-10-15).
- Resolved on branch `theme` (2026-10-15) in 0508c3a, 8fff070; code-review fixes in 8213e0e, bd5a6df, e844972. The two visual checks (dark identical, forced-light coherent) were reasoned from code and Mantine's CSS, not looked at, and stay open for a person. Undo-toast shadow kept in light, softened to `rgb(0 0 0 / 0.12)`.
