# Theme preference (light and dark)

A user chooses the app's theme: **Escuro** (the Night Ledger, default), **Claro** (the same ledger on paper) or **Automático** (follows the device's own setting, live). The choice is a **preference** of the account (PRD §3.5, [ADR-0002](../../docs/adr/0002-preferences-on-auth-user.md)), so every device the user signs in on shares it.

## Decisions (grilling session, 2026-10-15)

- **Reverses DESIGN.md's "Don't add a light theme".** Dark stays the signature and the default; light is a first-class scheme specified in DESIGN.md (Colors › Light scheme), not an ad-hoc inversion.
- **Three values**: `colorScheme` is `"dark" | "light" | "auto"`, default `"dark"`, so existing users see no change until they opt in. These match Mantine's `MantineColorScheme`.
- **Account-wide**, like `showSummary` and `confirmStatusChanges`: a typed Better-Auth `additionalFields` column with `input: true`, read from the session and saved through `update-user`. It is the first non-boolean preference, so `usePreference` is generalised beyond `boolean`. No new ADR: this follows ADR-0002.
- **Before the session is known** (first paint, and the signed-out screens Entrar, Cadastro and password reset), each device uses the last theme it applied, or Escuro if none. That copy is only a cache: once the session loads, the account's value wins (another device changed it, or another user signed in), and it is never sent at sign-up.
- **Light palette: yellow is fill-only** (DESIGN.md's Fill-Only Rule). Yellow text and lines (wordmark, auth links, focus ring) turn ink; needs-you group labels become ink on a yellow fill.
- **Control**: a "Tema" segmented control (Escuro · Claro · Automático), the first row of the Configurações modal. There is no header toggle. It behaves like the other preferences: applied at once, saved in the background, rolled back with the "Alteração não salva." alert on failure, and picked up by other devices on refocus.
- **Logo and favicon** are unchanged in both schemes. `<meta name="color-scheme">` and `<meta name="theme-color">` follow the applied scheme. The PWA manifest's static colours (`.scratch/pwa`) stay dark.
- **Automático** follows the OS live, without a reload.

## Tickets

1. [01-scheme-aware-colours](issues/01-scheme-aware-colours.md): every colour resolves per scheme; dark looks identical.
2. [02-theme-preference](issues/02-theme-preference.md): the preference, end to end.
3. [03-theme-before-session](issues/03-theme-before-session.md): first paint, signed-out screens and browser chrome.
