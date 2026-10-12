# 12: Delete or end a recurrence

**What to build:** the user deletes a recurrence that has no history; when it has persisted occurrences, they are offered to **end** it instead, keeping everything that already exists. Source: `docs/prd.md` §2, §5.4, §6.1, §7.6.

**Blocked by:** 07, 11

**Status:** ready-for-agent

- [x] `DELETE /api/v1/recurrences/:id` hard-deletes when no occurrence is persisted; otherwise `409 RECURRENCE_HAS_OCCURRENCES`
- [x] Ending is a `PATCH` of `endPeriod`; the UI asks for the last period (inclusive), defaulting to the current period
- [x] On the 409 the UI offers to end the recurrence instead
- [x] Delete and end actions on the recurrences screen and from an occurrence row
- [x] Integration tests: delete without history; 409 with history; after ending, no virtual occurrences are projected after `endPeriod` while persisted ones (even later ones) remain

## Comments

- Implemented. `DELETE /api/v1/recurrences/:id` lives in `apps/api/src/recurrences.ts`.
  - In one transaction it locks the recurrence `FOR UPDATE`, then deletes it only if no occurrence references it, whatever the occurrence's status. The lock holds back a concurrent materialization, whose foreign key needs a share lock on the same row. So the check and the delete cannot race.
  - It answers `204`. With persisted occurrences it answers `409 RECURRENCE_HAS_OCCURRENCES` and deletes nothing. Unknown ids, ids that are not uuids, and another user's recurrence get `404 RECURRENCE_NOT_FOUND`.
- `Refusal`, the error thrown inside a transaction to roll it back with a status and code, moved from `occurrences.ts` to `apps/api/src/refusal.ts`. The delete route uses it too.
- Ending stays the `PATCH` of `endPeriod` from ticket 11. No new route.
- The "Mais ações para …" menu (`apps/web/src/recurrence-actions.tsx`) now has "Editar recorrência", "Encerrar recorrência" and "Excluir recorrência".
  - It sits on every row of the recurrences screen, beside the badge. Clicking the row itself still edits.
  - It also sits on every recurrence-backed occurrence row of the monthly screen.
  - Each dialog loads the recurrence by id, so it names the recurrence, not the occurrence.
- "Excluir recorrência" (`apps/web/src/delete-recurrence.tsx`) confirms, then deletes. On the 409 the same dialog explains why and offers "Encerrar recorrência", which switches it to the end form.
- "Encerrar recorrência" (`apps/web/src/end-recurrence.tsx`) asks for "Último mês".
  - It defaults to the current period. For a recurrence starting later, the default is its start, since an earlier end would get `END_PERIOD_BEFORE_START`.
  - The default never goes past an end already set, so opening the dialog on an ended recurrence and confirming never extends it.
  - The picker cannot go before the start.
- Decision on ticket 11's question: the edit dialog's "Término" picker stays beside the dedicated flow. It is still how an end is cleared, which re-opens a recurrence.
- A deletion refetches only the recurrence lists (`invalidateRecurrenceLists`), not the deleted recurrence's own entry, which would only refetch into a 404 while the dialog closes.
- The fake API answers the delete with the same rules.
