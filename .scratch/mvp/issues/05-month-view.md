# 05: See the month

**What to build:** an approved user opens the monthly screen and sees the period's occurrences (persisted and virtual merged) with the Entradas/Saídas summary, and moves between periods. Data is seeded through Adminer or test fixtures; creating it from the UI comes in the following tickets. Source: `docs/prd.md` §3.1, §3.2, §4, §6.2, §7.1, §7.2.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [x] `recurrences` and `occurrences` tables per PRD §3 with uuid ids, FKs to users `ON DELETE CASCADE`, the partial unique index `(user_id, recurrence_id, period) WHERE recurrence_id IS NOT NULL` and every CHECK constraint of §3.2, in a drizzle-kit migration
- [x] `GET /api/v1/periods/:yyyy-mm` fetches the user's data and returns the payload of §6.2 by calling `resolvePeriod`, including overdue occurrences from earlier periods for the current period; invalid period → 400
- [x] Monthly screen with the period navigator (`< Outubro 2026 >`, one click or ←/→ keys), the summary bar (Entradas and Saídas, each Previsto and Realizado) and a flat list of items, amounts and dates formatted with `Intl` pt-BR / BRL
- [x] Integration tests: one user never sees another's recurrences or occurrences; deleting a user cascades to their recurrences and occurrences; a check constraint violation is rejected by the database

## Comments

- From ticket 02: when the requested period is the current one, pass `resolvePeriod` every persisted occurrence of earlier periods (all statuses), not only PENDING ones. A recurrence's settled or skipped earlier occurrence is what stops it being projected as an overdue virtual occurrence there.
- Implemented. Schema in `packages/database/lib/schema/app.ts`, migration `0001_recurrences_and_occurrences`. Besides the §3.2 CHECKs, the tables enforce §3.1's own invariants: periods on the 1st, `due_day` 1–31, `default_amount > 0`, `end_period >= start_period`. `occurrences.recurrence_id` references `recurrences` with `NO ACTION` (not `RESTRICT`), so deleting a user can cascade to both tables while deleting a recurrence with occurrences still fails (ticket 12 maps that to `409`).
- `GET /api/v1/periods/:yyyy-mm` lives in `apps/api/src/periods.ts`; invalid months get `400 INVALID_PERIOD`. For the current period it loads every earlier occurrence (all statuses); otherwise only the period's. `createApp` now takes `db` and an optional `now` clock, which the integration tests pin to 2026-10-12.
- `@mensal/shared` now exports `periodOfMonth` / `monthOf` ('YYYY-MM' ↔ period) and `shiftPeriod`.
- The monthly screen replaces the home at `/`, with the month in `?mes=YYYY-MM` (current period when absent or invalid). The period loads in the route loader through TanStack Query (`["period", period]`). Rows show "Liquidada" / "Pulada" / "Atrasada" badges so a flat list still tells states apart. `overdueFromPreviousPeriods` is returned but not rendered yet: ticket 08 owns showing it in **Atrasadas**.
- The web tests' fake API answers `/api/v1/periods` with the real `resolvePeriod`, seeded with `addRecurrence` / `addOccurrence`.
