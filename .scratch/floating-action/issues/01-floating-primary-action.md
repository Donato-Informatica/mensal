# 01: Floating primary action on phones

**What to build:** on phones, the screen's primary action ("Nova avulsa" on Mês, "Nova recorrência" on Recorrências) floats at the bottom right instead of taking a row of its own in the header. From `48em` up it stays in the header, as today. There is no setting for this: the PRD wants no bureaucratic configuration (§1), and the header has room on desktop.

**Blocked by:** none

**Status:** resolved

- [x] The action is rendered once. `.action` in `apps/web/src/app-layout.module.css` switches it between `position: fixed` at the bottom right (below `48em`) and its place in the header grid (from `48em` up). It is not rendered twice and hidden with CSS, because the jsdom tests would then find two buttons with the same name.
- [x] On phones the header loses its third row (`"action action"` in `grid-template-areas`). The button sits clear of the edges, with `env(safe-area-inset-bottom)` / `env(safe-area-inset-right)` included.
- [x] On phones `main` gets enough bottom padding that the floating button never covers the last occurrence or recurrence row.
- [x] One action per screen, with no speed dial. `AppLayout`'s `action` prop keeps its role.
- [x] Both buttons, on every size: a `+` icon plus the existing label ("Nova avulsa" / "Nova recorrência"), keeping the accessible names and the empty-state text in `month.tsx` that names "Nova avulsa". There is no icon library, so draw the icon as a small inline SVG (`aria-hidden`) rather than adding a dependency.
- [x] Both buttons use the filled primary (Highlighter Yellow). "Nova avulsa" changes from `variant="default"` to primary, since it is now the screen's primary action. Pill radius.
- [x] No shadow, glow or gradient (DESIGN.md, Flat Ledger Rule). The yellow on the canvas is enough to stand out.
- [x] Always visible, with no hide-on-scroll and no animation.
- [x] The dialogs the buttons open are unchanged.
- [ ] Existing web tests (`new-recurrence.test.tsx`, `one-off.test.tsx`) keep passing unchanged. Check the phone layout by hand in the browser, since jsdom does not apply the media query.

## Comments

- Settled in a grilling session (2026-10-14). The things we rejected:
  - **A Configurações switch**: the responsive rule covers the need.
  - **An icon-only button**: it would break the empty-state text and the button's name.
  - **A speed dial combining both actions.**
  - **Hide-on-scroll.**
  - **A shadowed FAB**: it breaks the Flat Ledger Rule.
- No glossary change and no ADR: this is a cheap-to-reverse UI choice, not a domain decision.
- Implemented on branch `floating-action` (2026-10-14): e4fb45d (feature), 09f9732 (shared `--mensal-primary-action-height`, undo toast lifted above the button on phones), d851736 (DESIGN.md describes the floating primary action). `npm run check` green; `new-recurrence.test.tsx` and `one-off.test.tsx` unchanged. Last checkbox left open: the phone layout still needs the manual browser check. The safe-area insets read 0 on iOS until `apps/web/index.html` gets `viewport-fit=cover`, which was left for a human to decide.
