# 10: One-off occurrences

**What to build:** the user records an occurrence that does not come from any recurrence, and can delete it; occurrences from a recurrence cannot be deleted, only skipped. Source: `docs/prd.md` §1.3, §5.9, §6.3, §7.7.

**Blocked by:** 05

**Status:** ready-for-agent

- [x] `POST /api/v1/occurrences` creates a one-off occurrence (direction, description, amount or null, period, due date within the period, notes) validated by the `@shared` schema
- [x] `DELETE /api/v1/occurrences/:id` hard-deletes a one-off; an occurrence with a recurrence → `409 ONLY_ONE_OFF_DELETABLE`
- [x] One-off dialog on the monthly screen, and a delete action on one-off rows only
- [x] Integration tests for creation, deletion, the 409, and tenant isolation

## Comments

- Implemented. `POST /api/v1/occurrences` lives in `apps/api/src/occurrences.ts`. Its body is `NewOneOffSchema` from `@mensal/shared`: `{ direction, description, amount, period, dueDate, notes }`, with `amount` and `dueDate` nullable and blank notes becoming `null`. The occurrence starts PENDING with no recurrence, and the route answers `201` with it. Any period is accepted, earlier ones included, since that is how history is entered (PRD §5.10).
- The schema is strict, so `status`, `recurrenceId`, `userId` and any other field get `400 INVALID_INPUT` naming it. A due date outside the period also gets `400 INVALID_INPUT` naming `dueDate`, not `DUE_DATE_OUTSIDE_PERIOD`. This follows the `/status` precedent: a rule the body alone decides is an input error, while `PATCH /:id` answers `DUE_DATE_OUTSIDE_PERIOD` because there the rule depends on the stored period. An invalid period is reported alone, not as the due date's fault as well.
- `DELETE /api/v1/occurrences/:id` hard-deletes the user's one-off and answers `204`.
  - An occurrence of a recurrence gets `409 ONLY_ONE_OFF_DELETABLE`. That covers a persisted one, a virtual id the recurrence projects, and a virtual id naming an occurrence that an ended recurrence kept. A virtual id is never materialized.
  - Unknown ids, ids that are not one, virtual ids outside the recurrence's periods, and anything of another user get `404 OCCURRENCE_NOT_FOUND`. Another user's occurrence never gets a 409, which would reveal that it exists.
- Monthly screen: the "Nova avulsa" button, beside "Nova recorrência", opens the "Nova conta avulsa" dialog (`apps/web/src/new-one-off.tsx`). It creates the one-off in the month on screen, which it names. To record history, the user moves back to that month first.
  - Fields: Tipo, Descrição, Valor with "A definir", Vencimento, and Observações.
  - Vencimento is optional and bounded to that month.
- One-off rows, and only those, get an "Excluir" action (`apps/web/src/delete-one-off.tsx`). It asks for confirmation in an "Excluir conta" dialog, because the delete is permanent. It is not optimistic. A failure stays in the dialog.
- The picker props of the date and month inputs moved to `apps/web/src/pickers.ts`, now that three dialogs share them. The description and notes input schemas are shared in `schemas.ts`.
