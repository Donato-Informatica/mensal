---
name: Mensal
description: A monthly cash-flow ledger read in the dark — near-black canvas, quiet grey rows, and one electric-yellow highlighter on what needs you.
colors:
  primary: "#faff69"
  primary-active: "#e6eb52"
  primary-disabled: "#3a3a1f"
  ink: "#ffffff"
  body: "#cccccc"
  muted: "#888888"
  muted-soft: "#5a5a5a"
  hairline: "#2a2a2a"
  hairline-strong: "#3a3a3a"
  canvas: "#0a0a0a"
  surface-card: "#1a1a1a"
  on-primary: "#0a0a0a"
  accent-emerald: "#22c55e"
  accent-rose: "#ef4444"
  # The light scheme (Claro): the same roles on paper. Yellow stays a fill.
  light-primary: "#faff69"
  light-primary-active: "#e6eb52"
  light-primary-disabled: "#f2f4c8"
  light-ink: "#0a0a0a"
  light-body: "#333333"
  light-muted: "#666666"
  light-muted-soft: "#a3a3a3"
  light-hairline: "#e5e5e5"
  light-hairline-strong: "#d4d4d4"
  light-canvas: "#f5f5f5"
  light-surface-card: "#ffffff"
  light-on-primary: "#0a0a0a"
  light-accent-emerald: "#15803d"
  light-accent-rose: "#dc2626"
typography:
  display-sm:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -1px
  figure:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
  title-sm:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  row-title:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.55
  amount:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.55
  body-md:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  caption-uppercase:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 1.5px
  button:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1
  wordmark:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.4
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  pill: 9999px
spacing:
  xs: 10px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0 18px
    height: 36px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.muted}"
  button-primary-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 0 18px
    height: 44px # 36px from 48em, in the header
  button-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0 18px
    height: 36px
  button-danger:
    backgroundColor: "{colors.accent-rose}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
  category-tab:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
  category-tab-active:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
  icon-button-round:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: 36px
  ledger-panel:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body}"
    rounded: "{rounded.lg}"
  ledger-row:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.row-title}"
    padding: 12px 20px
  summary-block:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.lg}"
    padding: 20px
  auth-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body}"
    rounded: "{rounded.lg}"
    padding: 32px
    width: 400px
  text-input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 36px
  settle-checkbox:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.md}"
    size: 20px
  settle-checkbox-checked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  badge-pill:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body}"
    rounded: "{rounded.pill}"
  badge-overdue:
    textColor: "{colors.accent-rose}"
    rounded: "{rounded.pill}"
  dialog:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
---

# Design System: Mensal

## Overview

**Creative North Star: "The Night Ledger"**

Mensal is a bank statement read in a dark room. The page is a near-black sheet; each month is a column of quiet grey rows ruled by hairlines; and a single electric-yellow highlighter marks the one thing that needs the reader right now: the button that does the act, the box just ticked, the control under the keyboard. Everything else stays dim on purpose, so the eye lands on what is due and what is left without searching.

Components are quiet, exact, one-touch. Surfaces sit a hair above the canvas, borders are 1px, and nothing floats but interruptions and, on phones, the screen's primary action, as flat as the rest. Controls behave like precise instruments: one click settles a row, one menu holds the rest. Density is that of a ledger, not a dashboard. Rows are compact enough to see a whole month at phone width, and nothing on screen is decoration.

The palette and type were inherited from ClickHouse's marketing system: the black, the yellow, Inter set tight. Mensal keeps only what an app needs. It has no marketing bands, stat callouts, pricing tiers or code windows, and it never sets display type above 32px.

The Night Ledger is the signature and the default. A user can also choose the light scheme (Claro), or follow their device (Automático), as a preference of their account (PRD §3.5). The light scheme is the same ledger on paper, not an inversion: same layout, same roles, same rules, with yellow kept to fills (see Light scheme).

**Key Characteristics:**

- Dark first. Canvas `{colors.canvas}` is the page; `{colors.surface-card}` lifts panels by tone alone. The light scheme mirrors every role on paper.
- One yellow, rationed: primary action, checked state, focus ring, the lockup (wordmark and logo mark), and the labels and panel edges of the two groups that need you now (Atrasadas, Vencem hoje).
- Green means money coming in; red means late or destructive. Neither is decorative.
- Inter throughout. Display at 700 with tight tracking; everything else 400–600.
- Flat: hairline borders, no shadows on resting surfaces.
- Rows, not cards. A month is a ruled list inside one panel per group.

## Colors

Monochrome on black, with one highlighter and two signal colours that carry meaning.

### Primary

- **Highlighter Yellow** (`{colors.primary}`): the primary button, the checked settle box, switches turned on, the focus ring, the wordmark and the logo mark's edge and checked box. It is never body text or a large fill.
- **Pressed Highlighter** (`{colors.primary-active}`): hover and pressed state of the primary button.
- **Spent Highlighter** (`{colors.primary-disabled}`): a disabled primary button, such as the amount popover's "Liquidar" before a value is typed.

### Signal

- **Inflow Emerald** (`{colors.accent-emerald}`): the amounts of inflows (Entradas) in ledger rows, and success alerts. Outflows stay white; emerald is the only thing that sets money in apart from money out.
- **Overdue Rose** (`{colors.accent-rose}`): the badge naming an earlier period's overdue row, error alerts, and destructive actions (Excluir). Light variants (tinted surface, rose text) carry alerts and the overdue badge; solid rose is reserved for the confirming destructive button.

### Neutral

- **Paper White** (`{colors.ink}`): headings, row descriptions, amounts and summary figures: the facts.
- **Ledger Grey** (`{colors.body}`): running text, dialog copy and inactive header buttons.
- **Pencil Grey** (`{colors.muted}`): "dimmed" text, such as due dates under a description and quiet group labels.
- **Faint Grey** (`{colors.muted-soft}`): tertiary marks only.
- **Night Canvas** (`{colors.canvas}`): the page, the sticky period navigator, dialogs, menus and popovers.
- **Panel Black** (`{colors.surface-card}`): ledger panels, summary blocks, the auth card, inputs, default buttons, the active screen tab and round icon buttons.
- **Ruling Line** (`{colors.hairline}`): dividers between ledger rows and under the app header.
- **Panel Edge** (`{colors.hairline-strong}`): 1px borders of panels, inputs, default buttons, badges, menus and popovers.

**The Highlighter Rule.** Yellow marks the single thing that needs the reader. A view has at most one yellow button. If two things want yellow, one of them is wrong.

**The Meaning-Only Rule.** Emerald means money in; rose means late or destructive. They never appear for emphasis, decoration or brand.

### Light scheme

Every role above has a light counterpart, prefixed `light-`. The page is Paper Canvas (`{colors.light-canvas}`) and panels lift to pure white (`{colors.light-surface-card}`), so depth is still tonal and still upwards. Text runs Ink (`{colors.light-ink}`) for the facts, `{colors.light-body}` for running text and `{colors.light-muted}` for dimmed text. Hairlines are `{colors.light-hairline}` and `{colors.light-hairline-strong}`. Inflow amounts take `{colors.light-accent-emerald}` and rose takes `{colors.light-accent-rose}`, both dark enough to pass 4.5:1 as text on white.

**The Fill-Only Rule.** On paper, yellow is too faint to read as text or as a line, so in the light scheme it is only ever a fill with ink on or inside it: the primary button and primary action, the checked settle box (black tick), a switch turned on, the needs-you group labels, and the offline "Sem conexão" banner (ink text and icon on a yellow fill, in both schemes). Everything that is yellow text or a yellow line in the dark scheme turns ink instead: the wordmark, text links on the auth screens, and the focus ring. Yellow fills that are controls (the checked box, a switch's track) carry a 1px ink border so their shape still reads on white.

- **Needs-you groups** (Atrasadas, Vencem hoje): the label is ink on a yellow fill, padded like a highlighter stroke (2px × 6px, `{rounded.xs}`), and the panel edge is ink instead of Panel Edge.
- **Spent Highlighter** (`{colors.light-primary-disabled}`): a pale yellow with `{colors.light-muted}` text.
- **Danger:** solid `{colors.light-accent-rose}` with white text.

## Typography

**Display Font:** Inter Variable (self-hosted via `@fontsource-variable/inter`; with -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** the same Inter Variable
**Label Font:** the same, uppercase and tracked

**Character:** One humanist sans does the whole ledger. Hierarchy comes from size and weight steps (400 / 500 / 600 / 700) and from white against grey, never from a second family.

### Hierarchy

- **Display** (`{typography.display-sm}`): the screen title, such as "Outubro 2026" in the period navigator, and the auth card titles. It is the largest type in the product.
- **Figure** (`{typography.figure}`): summary amounts under Previsto and Realizado, in white.
- **Title** (`{typography.title-sm}`): summary block titles (Entradas, Saídas).
- **Row title** (`{typography.row-title}`): an occurrence's or recurrence's description, in white, truncated on one line.
- **Amount** (`{typography.amount}`): the row's amount, never wrapping; emerald for inflows, white for outflows, "A definir" is white on a dashed underline with a pencil, a button that opens the edit dialog. Every amount carries a direction arrow and a +/− sign, so colour is never the only cue.
- **Body** (`{typography.body-md}`): dialog copy and forms. The entity a dialog acts on is set in white at 600 inside the sentence, e.g. "**Aluguel** será liquidada por R$ 2.200,00."
- **Small** (`{typography.body-sm}`): due dates, form hints and links on the auth screens, in Pencil Grey.
- **Label** (`{typography.caption-uppercase}`): group headings (ATRASADAS, A VENCER NO MÊS) and the Previsto/Realizado labels. Uppercase, tracked 1.5px, Pencil Grey, or rose for Atrasadas.

**The Tight Display Rule.** Display type is 700 with -1px tracking (set on every `Title` by the theme). Labels go the other way: 12px uppercase opened to +1.5px. Nothing sits in between.

**The Thirty-Two Ceiling Rule.** Nothing is set larger than 32px. A ledger screen has no hero.

## Layout

- **Frame:** a header ruled off by a `{colors.hairline}` line, then one centred column, Mantine's `xl` container (1320px max), with 32px of vertical padding. From 48em the header is one 64px row: lockup and screen tabs on the left; the screen's primary action and the account avatar side by side on the right. On phones it is one row too, the lockup and the screen tab on the left and the account avatar on the right; the screen tab keeps its label, and the primary action floats at the bottom right, and the column's bottom padding grows to clear it.
- **Rhythm:** sections of a screen are 32px apart (`xl`). A group label sits 12px (`sm`) above its panel. Rows are padded 12px × 20px. Summary blocks pad 20px and the auth card 32px.
- **Scale:** Mantine's default spacing, 10 / 12 / 16 / 20 / 32px (`xs` to `xl`). Radii and colours are themed; spacing is not.
- **Period navigator:** sticky at the top of the month screen on the canvas colour, a three-column grid of [side | ‹ title › | side]. The centre group is 400px wide at most. Away from the current month, "Mês atual" sits in the side column toward it, against the arrow that points back (left on a later month, right on an earlier one). The side columns are equal and always wide enough for it, so the title never shifts.
- **Occurrence bar:** directly above the occurrences, 12px (`sm`) from them: the Lista / Tabela switch (icon and label) on the left, "Exportar CSV" on the right. Both are 36px tall. Controls that act on the occurrences sit with them, not with the navigator.
- **Summary:** two blocks, one column on phones and two from 576px (`xs`) up.
- **Auth screens:** a single 400px card, centred in the viewport. From 48em the stacked lockup sits beside it on the left, 64px away and on the card's vertical centre; on phones it is centred above the card, 32px (`xl`) clear of it.
- **Responsive:** phones are the main device for settling (PRODUCT.md), so every screen must hold at 360–375px with touch targets of at least 36px. The header and the navigator row both fit at that width; the longer month names wrap the title onto two lines.

## Elevation & Depth

Flat. Depth is tonal: `{colors.surface-card}` panels sit on the `{colors.canvas}` page, edged by a 1px `{colors.hairline-strong}` border. No resting surface casts a shadow. Layering is interruption: dialogs, menus and popovers open over the page, and dialogs dim it with Mantine's overlay. Dialogs drop Mantine's shadow for a Panel Edge border, since a canvas-coloured dialog over a dimmed canvas has no edge otherwise; the default shadow on menus and popovers is tolerated, not part of the language. The one exception is the screen's primary action on phones, which floats at the bottom right, flat and shadowless: yellow on the canvas is enough.

**The Flat Ledger Rule.** If a surface needs to stand out, give it Panel Black and a Panel Edge border. Never a shadow, a glow or a gradient.

## Shapes

Gently squared. Buttons, inputs, checkboxes and dialogs use 8px corners (`{rounded.md}`). Panels, summary blocks and the auth card use 12px (`{rounded.lg}`). Fully round is kept for the 36px month-step buttons (‹ ›), the screen's primary action and badges. Borders are always 1px. Rows inside a panel are separated by a 1px rule, never boxed.

**The Rows-Not-Cards Rule.** A group of occurrences is one panel with ruled rows. Never a card per row, and never a panel nested inside a panel.

## Components

### Buttons

- **Shape:** gently squared (8px), 36px tall, 14px / 600 labels. The screen's primary action is the exception.
- **Primary:** Highlighter Yellow with black text. The act a view exists for: "Liquidar", "Pular", "Criar", "Entrar".
- **Primary action** (button-primary-action): the act a screen exists for, "Nova avulsa" on Mês and "Nova recorrência" on Recorrências. A primary pill with a `+` before its label, 44px tall on phones and 36px from 48em. On phones it floats at the bottom right, clear of the edges and the safe area; from 48em it sits in the header. One per screen, flat, never icon-only.
- **Default:** Panel Black with a Panel Edge border and white text, for secondary acts such as "Cancelar".
- **Danger:** solid Overdue Rose, only for confirming a deletion. In a destructive dialog, focus starts on "Cancelar".
- **Subtle:** no fill and near-white text, for header actions.
- **Focus:** Mantine's 2px focus ring on every control, offset from the edge: yellow in the dark scheme, ink in the light one. It is never removed.

### Screen tabs (category-tab)

Header navigation between "Mês" and "Recorrências". The active tab is filled Panel Black with white text and `aria-current="page"`; the inactive tab is subtle and grey.

### Ledger panel and rows

- **Panel:** Panel Black, a 1px Panel Edge border, 12px corners, rendered as a `ul`.
- **Row:** settle checkbox, then description (white, 500, truncated) over its due date ("10/10" or "Sem vencimento", Pencil Grey, 14px), then amount, optional badge and a "Mais ações" (⋯) menu on the right. Rows after the first carry a 1px Ruling Line on top.
- **Settle checkbox:** 20px, 8px corners. Checked is Highlighter Yellow with a black tick. One click settles. When the amount is still "A definir", a popover asks only for the amount.

### Summary blocks

Two panels, Entradas and Saídas, each with a 16px / 600 title and two figures (Previsto, Realizado). Each figure is an uppercase tracked label over a 20px / 700 white amount. They can be hidden per device in Configurações.

### Badges (badge-pill)

Mantine's small uppercase pills. The default badge is Panel Black with a Panel Edge border and grey text: LIQUIDADA, PULADA, ENCERRADA. The overdue badge uses the light rose variant and names the earlier period the row belongs to. Overdue rows in the current period get no badge, since their group already says so.

### Inputs

Panel Black fill, Panel Edge border, 8px corners, 36px tall, labels above the field. Fields carry no required asterisks, because every field asked for is required. Money uses a `R$ ` prefix with `,` decimals and `.` thousands. Focus moves the border to yellow.

### Dialogs, menus and popovers

- **Dialog:** centred, on the canvas colour, edged by a 1px Panel Edge border and no shadow, padded 20px over a page dimmed to 75%. The title names the act ("Liquidar conta", "Excluir conta") in the figure step, 20px / 700 white. The body is one sentence with the entity in white 600. Buttons sit right-aligned: Cancelar (default) then the act (primary, or danger); on phones they share the row at 44px, and the close button grows to 44px. Settings are ruled rows, label first and switch at the row's end; the theme (Tema) is the first row, a segmented control (Escuro · Claro · Automático) in place of the switch. Errors appear as a light rose alert at the top of the dialog body. A dialog that holds input (a form, Configurações, Alterar senha, Tokens de acesso) ignores a click outside, so half-typed input is never lost; Esc, the close button and Cancelar (or Fechar) still close it. Confirmations, which hold nothing, and the trend close on a click outside. The theme defaults to ignoring it; a dialog that should close opts in with `closeOnClickOutside`.
- **Menu:** opened from the row's ⋯ action icon. Items are plain text and destructive items are rose.
- **Account menu:** opened from the header's avatar ("Conta"): the user icon, white on Panel Black with a 1px Panel Edge border, never yellow, 44px on phones and 36px from 48em. The menu opens with the name (white, 500) over the email (Pencil Grey, 14px), both truncated, then Configurações, Alterar senha and Tokens de acesso (a key icon), a rule, and Sair. Icons sit before the labels and Sair is plain, not rose: signing out loses nothing. Each item opens its dialog.
- **Popover:** anchored to the control that opened it, with an arrow and focus trapped inside. It asks for one thing only.

### Lockup

In the header, the 28px logo mark, a 10px (`xs`) gap, then the wordmark. On the auth screens the lockup is stacked and centred: the mark over the wordmark, 12px (`sm`) apart, the mark 160px from 48em and 80px on phones. The mark is decorative (empty alt), since the wordmark names the app. The same mark is the favicon.

- **Wordmark:** "Mensal" in 18px / 700 Highlighter Yellow in the header; in the stacked lockup it takes the display step, 32px / 700 at -1px tracking (24px on phones). Apart from text links on the auth screens (Mantine anchors take the primary colour), it is the only yellow text in the product. In the light scheme it is ink (the Fill-Only Rule).
- **Logo mark:** `apps/web/public/logo.svg`, a Night Canvas tile edged in Highlighter Yellow holding three ledger rows: two quiet Faint Grey rows and, between them, a settled one (a yellow checked box beside a Paper White line). Its colours are the tokens above; change them here first. It is the same in both schemes: a dark tile reads on paper too.

## Do's and Don'ts

### Do:

- **Do** keep at most one yellow button per view, and give it the act the view exists for.
- **Do** colour inflow amounts emerald and outflow amounts white. Show "A definir" as a dashed-underlined button when there is no amount, and never let direction rest on colour alone (arrow, sign, hidden Entrada/Saída).
- **Do** reserve rose for overdue, errors and destructive actions, using its light variant except on the confirming delete button.
- **Do** put a group's rows in one 12px-cornered panel ruled by 1px lines.
- **Do** name the entity in dialog copy in white at 600 weight, inside a plain sentence.
- **Do** take colours from the theme (`apps/web/src/theme.ts`) by role, so each resolves per scheme, rather than inline hex or a fixed palette shade like `white` or `dark.6`.
- **Do** design and check every screen at 375px first. Settling happens on phones.
- **Do** check every screen in both schemes.

### Don't:

- **Don't** use yellow as text or as a line in the light scheme. On paper it is a fill, with ink on it.
- **Don't** introduce a second accent colour, gradients, glows or shadows on resting surfaces.
- **Don't** set type above 32px, or add hero, stat-callout or marketing-banner treatments carried over from the ClickHouse marketing system. (The offline "Sem conexão" banner is a status bar, not one of these.)
- **Don't** use yellow for body text, large fills or decoration.
- **Don't** use emerald or rose for emphasis that does not mean money in, late or destructive.
- **Don't** wrap individual rows in cards or nest panels inside panels.
- **Don't** let the header or the period navigator push the page wider than the viewport. Check both at 360px.
