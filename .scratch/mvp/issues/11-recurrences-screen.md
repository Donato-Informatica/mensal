# 11: Recurrences screen: list and edit

**What to build:** a second screen where the user lists their recurrences (active or all) and edits them; edits change every virtual occurrence but never materialized ones. Source: `docs/prd.md` §3.1, §3.3, §5.3, §6.1, §7.6.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] `GET /api/v1/recurrences?status=active|all` (active = `endPeriod` null or ≥ current period, including future starts) and `GET /api/v1/recurrences/:id`
- [x] `PATCH /api/v1/recurrences/:id` updates `description`, `defaultAmount`, `dueDay`, `endPeriod` and `notes`; changes to `direction` or `startPeriod` are rejected
- [x] Recurrences screen with the active/all filter and an edit action; the edit is also reachable from an occurrence row on the monthly screen
- [x] Integration tests: filter semantics; editing changes virtual occurrences but leaves materialized ones untouched; tenant isolation

## Comments

- Implemented. `GET /api/v1/recurrences` lives in `apps/api/src/recurrences.ts` and takes `?status=active|all` (`RecurrenceListQuerySchema` in `@mensal/shared`).
  - Without a status it lists the active ones. Any other value gets `400 INVALID_INPUT` naming `status`.
  - The list is ordered by description.
  - `@mensal/shared` exports `isActive(recurrence, currentPeriod)` for the same rule client-side.
- `GET /api/v1/recurrences/:id` answers with the user's recurrence. Unknown ids, ids that are not uuids, and another user's recurrence all get `404 RECURRENCE_NOT_FOUND`. The uuid regex moved to `apps/api/src/uuid.ts`.
- `PATCH /api/v1/recurrences/:id` takes `RecurrenceEditSchema`, a strict object of optional `description`, `defaultAmount`, `dueDay`, `endPeriod` and `notes`.
  - `direction`, `startPeriod` or any other field gets `400 INVALID_INPUT` naming it.
  - An `endPeriod` before the stored start gets `400 END_PERIOD_BEFORE_START`. This follows the ticket 10 precedent: a rule that depends on stored state gets its own code. POST keeps reporting it as `INVALID_INPUT`, since there the body alone decides it.
  - An empty body answers the recurrence unchanged.
  - Virtual occurrences follow the edit in every period, past ones included. Persisted ones keep their snapshot.
- The recurrences screen is at `/recorrencias` (`apps/web/src/recurrences.tsx`). "Ativas"/"Todas" switches it, with `?filtro=todas` in the URL.
  - Each row shows the description, the due day, the span ("desde outubro 2026" or "novembro 2026 a março 2027") and the amount.
  - Ended recurrences carry an "Encerrada" badge.
  - Clicking a row opens "Editar recorrência" (`apps/web/src/edit-recurrence.tsx`). It has Descrição, Valor with "A definir", Dia do vencimento, Término and Observações. Direction and start are shown as text, since they cannot change.
- The header now links "Mês" and "Recorrências", styled as DESIGN.md category tabs.
- On the monthly screen, rows from a recurrence get a "Mais ações para …" menu (`apps/web/src/recurrence-actions.tsx`) with "Editar recorrência". It loads the recurrence by id (`GET /:id`), so the form shows the recurrence as it is now, not the occurrence's snapshot. Ticket 12 can add "Encerrar" and "Excluir" to the same menu.
- After an edit, every cached period and recurrence list is invalidated. Creating a recurrence now invalidates the lists too.
- The fake API answers the three new routes with the same rules.
- For ticket 12: the edit dialog's "Término" picker already sets or clears `endPeriod`. Clearing it re-opens an ended recurrence. Ticket 12 should decide whether the dedicated "Encerrar" flow (defaulting to the current period) replaces it or sits beside it.
