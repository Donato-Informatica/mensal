# 05: See the month

**What to build:** an approved user opens the monthly screen and sees the period's occurrences (persisted and virtual merged) with the Entradas/Saídas summary, and moves between periods. Data is seeded through Adminer or test fixtures; creating it from the UI comes in the following tickets. Source: `docs/prd.md` §3.1, §3.2, §4, §6.2, §7.1, §7.2.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] `recurrences` and `occurrences` tables per PRD §3 with uuid ids, FKs to users `ON DELETE CASCADE`, the partial unique index `(user_id, recurrence_id, period) WHERE recurrence_id IS NOT NULL` and every CHECK constraint of §3.2, in a drizzle-kit migration
- [ ] `GET /api/v1/periods/:yyyy-mm` fetches the user's data and returns the payload of §6.2 by calling `resolvePeriod`, including overdue occurrences from earlier periods for the current period; invalid period → 400
- [ ] Monthly screen with the period navigator (`< Outubro 2026 >`, one click or ←/→ keys), the summary bar (Entradas and Saídas, each Previsto and Realizado) and a flat list of items, amounts and dates formatted with `Intl` pt-BR / BRL
- [ ] Integration tests: one user never sees another's recurrences or occurrences; deleting a user cascades to their recurrences and occurrences; a check constraint violation is rejected by the database
