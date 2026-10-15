# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The author and a small circle of people they approve by hand: Brazilian individuals managing their own monthly income and bills. Sign-up is open, but nobody uses the product until an administrator sets `users.approved = true` (PRD §3.4), so the audience is small and trusted, not a public market.

Their job is to answer two questions each month (PRD §1.1): which bills are due and how much of the salary will be left, and whether a given bill has been paid yet.

## Product Purpose

Mensal forecasts and settles one person's monthly cash flow. Recurrences anticipate what is coming each month; the user reviews the month and settles occurrences as they are paid or received. Success is answering both monthly questions at a glance and recording a payment in one click, with no data-entry chores in between.

## Positioning

Minimalist and opinionated where most personal-finance tools overdo it (PRD §1.2). It deliberately has no balances, categories, charts, multiple currencies or non-monthly periodicity (PRD §1.3). Future months need no setup: occurrences are projected from recurrences at read time and only stored once touched ([ADR-0001](docs/adr/0001-virtual-occurrences.md)), so the month ahead is always there and always reflects the recurrence as it is now.

## Operating Context

- **Month start, any device:** a sit-down review of the coming month: the summary (Entradas / Saídas, Previsto / Realizado), what is overdue, and what falls due.
- **Right after paying, mostly on a phone:** open the app, find the bill, settle it. Phone use is the heavier share overall, so narrow viewports and touch are the primary case, not an afterthought.
- **Occasional upkeep:** adding a one-off bill, editing, ending or deleting a recurrence, skipping one month's occurrence.

## Capabilities and Constraints

- The spec is `docs/prd.md`; its section references ("PRD §x.y") are binding. Domain vocabulary and its pt-BR UI strings come from `GLOSSARY.md` (e.g. Settle → Liquidar, Skip → Pular, Overdue → Atrasada, Expected → Previsto, Settled total → Realizado, One-off → Avulsa).
- UI text is Brazilian Portuguese only, written in the components; no internationalization. Amounts are always BRL; dates and currency are formatted with `Intl` in `pt-BR`. "Today" is computed in `America/Sao_Paulo`.
- Monthly periodicity only: annual bills are one-off occurrences, installments are recurrences with an end period.
- Statuses are Pendente, Liquidada and Pulada; overdue is derived, never stored. Status changes are optimistic, rolling back on failure (PRD §7.5).
- The monthly screen groups occurrences as Atrasadas (including earlier periods' overdue ones), Vencem hoje, A vencer no mês, Liquidadas e puladas (PRD §7.4).
- No email of any kind: password-reset links are printed to the server log for the administrator to forward. No billing or paid plans.
- Per-device display preferences live in the browser (e.g. showing the summary, confirming status changes).

## Brand Commitments

- Name: **Mensal**, shown as a lockup (the logo mark, `apps/web/public/logo.svg`, beside the wordmark) in the app header, and stacked beside the auth card (above it on phones); the mark is also the favicon.
- Voice: plain, short Brazilian Portuguese that uses the glossary's terms and never its listed synonyms to avoid.
- The visual system is recorded in `DESIGN.md` and mapped onto Mantine in `apps/web/src/theme.ts`; it is not restated here.

## Evidence on Hand

None beyond the product itself. There are no testimonials, user counts, press or case studies, and future work must not invent any.

## Product Principles

1. **Two questions, answered at a glance.** What is due and what is left, and whether a given bill is paid. Anything that does not serve these is a non-goal until the PRD says otherwise.
2. **Settling is one click.** Ask for more only when the data is missing (an amount to be defined) or when the user opted to confirm.
3. **The month is always ready.** No setup per month and no stale pre-generated data: the user opens any month and it is there.
4. **Never lose settled history.** Destructive actions are refused or confirmed: a recurrence with history is ended, not deleted.
5. **The phone is the primary device for settling.** Layouts and controls must work at phone width with touch first.

## Accessibility & Inclusion

WCAG 2.2 AA as the standing baseline: text and control contrast, full keyboard operation with visible focus, accessible names for every control (the web tests query by role and name), and touch targets sized for phone use. No specific user needs are known.
