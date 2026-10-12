# Virtual occurrences projected at read time, materialized on first touch

Occurrences of a recurrence are not pre-created. When a period is read, each recurrence in effect without a persisted occurrence in that period is projected in memory as a virtual occurrence. It is only inserted (materialized, via an idempotent upsert on `(user_id, recurrence_id, period)`) when the user first mutates it. We chose this over a scheduled job that creates occurrences month by month because it needs no scheduler, lets any period (past or future) be browsed without backfilling, and makes recurrence edits show up immediately in every untouched period, while materialization freezes the history the user actually interacted with.

## Consequences

- Untouched virtual occurrences, including past ones, always reflect the recurrence as it is now; only materialized occurrences keep a snapshot.
- Reading a period, and especially collecting overdue occurrences from earlier periods, must project virtuals across each recurrence's `startPeriod`..`endPeriod`. This is why a recurrence's `startPeriod` cannot be earlier than its creation month.
