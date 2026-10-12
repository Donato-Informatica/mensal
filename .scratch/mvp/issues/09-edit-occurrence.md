# 09: Edit an occurrence

**What to build:** the user edits an occurrence's description, amount, due date, settlement date and notes; editing a virtual occurrence materializes it. Source: `docs/prd.md` §5.2, §5.8, §6.3.

**Blocked by:** 07

**Status:** ready-for-agent

- [x] `PATCH /api/v1/occurrences/:id` accepts a persisted or virtual id and updates `description`, `amount`, `dueDate`, `settledAt` and `notes`; virtual ids are materialized with the same upsert as status changes
- [x] A due date outside the period → `DUE_DATE_OUTSIDE_PERIOD`; `settledAt` only accepted when SETTLED; `direction`, `period` and `recurrenceId` cannot be changed
- [x] Edit form reachable from an occurrence row on the monthly screen
- [x] Integration tests for each rule above, and that editing a virtual occurrence leaves the recurrence untouched

## Comments

- Implemented. `PATCH /api/v1/occurrences/:id` lives in `apps/api/src/occurrences.ts`. Its body is `OccurrenceEditSchema` from `@mensal/shared`: `{ description?, amount?, dueDate?, settledAt?, notes? }`, where an absent field stays as it is. `amount` and `dueDate` may be `null`, and blank notes become `null`. It answers `200` with the persisted occurrence. Unknown ids, another user's ids, and virtual ids outside their recurrence's periods get `404 OCCURRENCE_NOT_FOUND`, the same as the status route.
- The schema is strict. Any other field (`direction`, `period`, `recurrenceId`, and also `status`, which only changes through `/status`) gets `400 INVALID_INPUT` naming it. `invalidInput` now names unrecognized keys.
- Refusals that depend on the occurrence's stored state come from `editRefusal` in `@mensal/shared`, which the API and the web fake share. Every refusal rolls back a materialization in the same transaction.
  - `DUE_DATE_OUTSIDE_PERIOD`: the due date falls outside the occurrence's period.
  - `OCCURRENCE_NOT_SETTLED`: a `settledAt` is sent for an occurrence that isn't SETTLED. This differs from `/status`, which answers `INVALID_INPUT` because there the rule depends on the body alone.
  - `AMOUNT_REQUIRED_TO_SETTLE`: `amount: null` is sent for a SETTLED occurrence.
- Both routes now go through one `changeOccurrence` helper: materialize and lock, compute the changes (or throw a `Refusal`), then update. An edit that changes nothing still materializes and answers the occurrence.
- Monthly screen: the description and due-date block of each row is a button ("Editar <descrição>") that opens the "Editar conta" dialog (`apps/web/src/edit-occurrence.tsx`).
  - Fields: Descrição, Valor with "A definir" (hidden when settled), Vencimento, and Observações.
  - Vencimento is a date picker bounded to the occurrence's own period, so it also works for rows from earlier periods, and it is clearable.
  - "Data da liquidação" appears only when the occurrence is settled.
  - The edit is not optimistic: it waits for the API, refetches the periods, then closes. A failure stays in the dialog, with what was typed kept.
