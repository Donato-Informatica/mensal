import { clampDueDate } from "./due-date.ts";
import { shiftPeriod } from "./period.ts";
import { applyStatusChange } from "./status-change.ts";
import { periodOf } from "./today.ts";
import { virtualId } from "./virtual-id.ts";
import type {
  Direction,
  Occurrence,
  OccurrenceStatus,
  Recurrence,
  StatusChange,
} from "./schemas.ts";

/** One occurrence of a period payload, persisted or virtual. */
export interface PeriodItem {
  id: string;
  isVirtual: boolean;
  recurrenceId: string | null;
  direction: Direction;
  description: string;
  status: OccurrenceStatus;
  amount: number | null;
  period: string;
  dueDate: string | null;
  settledAt: string | null;
  notes: string | null;
  overdue: boolean;
}

/** Totals in cents per direction. Skipped occurrences never count. */
export interface PeriodSummary {
  /** Pending and settled inflows. */
  inflowExpected: number;
  /** Settled inflows only. */
  inflowSettled: number;
  /** Pending and settled outflows. */
  outflowExpected: number;
  /** Settled outflows only. */
  outflowSettled: number;
}

export interface PeriodPayload {
  period: string;
  summary: PeriodSummary;
  items: PeriodItem[];
  /** Overdue occurrences of earlier periods; empty unless `period` is the current one. */
  overdueFromPreviousPeriods: PeriodItem[];
}

/** The fields of a persisted occurrence that `resolvePeriod` reads. */
type PersistedOccurrence = Pick<
  Occurrence,
  | "id"
  | "recurrenceId"
  | "direction"
  | "description"
  | "status"
  | "amount"
  | "period"
  | "dueDate"
  | "settledAt"
  | "notes"
>;

/** The fields of a recurrence that `resolvePeriod` reads. */
type ProjectedRecurrence = Pick<
  Recurrence,
  | "id"
  | "direction"
  | "description"
  | "defaultAmount"
  | "dueDay"
  | "startPeriod"
  | "endPeriod"
>;

export interface ResolvePeriodInput {
  /** The period to resolve, 'YYYY-MM-01'. */
  period: string;
  /** Today in America/Sao_Paulo, 'YYYY-MM-DD' (see `today()`). */
  today: string;
  /**
   * The user's persisted occurrences of `period`. When `period` is the current
   * one, also every persisted occurrence of earlier periods: a recurrence's
   * earlier occurrence, whatever its status, keeps it from being projected as
   * overdue there. Occurrences of other periods are ignored.
   */
  occurrences: readonly PersistedOccurrence[];
  /** The user's recurrences; those not in effect for a period are ignored. */
  recurrences: readonly ProjectedRecurrence[];
}

/**
 * Resolves the payload of `period`: its persisted occurrences merged with the
 * virtual occurrences of the recurrences in effect, ordered by due date, the
 * summary, and (current period only) overdue occurrences of earlier periods.
 * See PRD §4 and ADR 0001.
 */
export function resolvePeriod({
  period,
  today,
  occurrences,
  recurrences,
}: ResolvePeriodInput): PeriodPayload {
  const items = occurrencesBetween(period, period, occurrences, recurrences)
    .map((item) => withOverdue(item, today))
    .sort(byDueDate);
  const isCurrent = period === periodOf(today);
  const overdueFromPreviousPeriods = isCurrent
    ? occurrencesBetween(
        EARLIEST_PERIOD,
        previousPeriod(period),
        occurrences,
        recurrences
      )
        .map((item) => withOverdue(item, today))
        .filter((item) => item.overdue)
        .sort(byDueDate)
    : [];
  return {
    period,
    summary: summarize(items),
    items,
    overdueFromPreviousPeriods,
  };
}

/** A period item before its `overdue` flag is derived. */
type UnflaggedItem = Omit<PeriodItem, "overdue">;

/** A lower bound for `occurrencesBetween` that every period is after. */
const EARLIEST_PERIOD = "0000-01-01";

/**
 * The persisted occurrences of the periods `first`..`last` (inclusive), plus a
 * virtual occurrence for each of those periods in which a recurrence is in
 * effect without a persisted occurrence.
 */
function occurrencesBetween(
  first: string,
  last: string,
  occurrences: readonly PersistedOccurrence[],
  recurrences: readonly ProjectedRecurrence[]
): UnflaggedItem[] {
  const persisted = occurrences.filter(
    (occurrence) => occurrence.period >= first && occurrence.period <= last
  );
  const materialized = new Set(
    persisted.flatMap((occurrence) =>
      occurrence.recurrenceId === null
        ? []
        : [virtualId(occurrence.recurrenceId, occurrence.period)]
    )
  );
  const virtual = recurrences.flatMap((recurrence) => {
    const from = max(first, recurrence.startPeriod);
    const to =
      recurrence.endPeriod === null ? last : min(last, recurrence.endPeriod);
    return periodsBetween(from, to)
      .filter((period) => !materialized.has(virtualId(recurrence.id, period)))
      .map((period) => projectVirtual(recurrence, period));
  });
  return [...persisted.map(fromPersisted), ...virtual];
}

function fromPersisted(occurrence: PersistedOccurrence): UnflaggedItem {
  return {
    id: occurrence.id,
    isVirtual: false,
    recurrenceId: occurrence.recurrenceId,
    direction: occurrence.direction,
    description: occurrence.description,
    status: occurrence.status,
    amount: occurrence.amount,
    period: occurrence.period,
    dueDate: occurrence.dueDate,
    settledAt: occurrence.settledAt,
    notes: occurrence.notes,
  };
}

/** The virtual occurrence of `recurrence` in `period`, as the recurrence is now. */
function projectVirtual(
  recurrence: ProjectedRecurrence,
  period: string
): UnflaggedItem {
  return {
    id: virtualId(recurrence.id, period),
    isVirtual: true,
    recurrenceId: recurrence.id,
    direction: recurrence.direction,
    description: recurrence.description,
    status: "PENDING",
    amount: recurrence.defaultAmount,
    period,
    dueDate: clampDueDate(period, recurrence.dueDay),
    settledAt: null,
    notes: null,
  };
}

/** Every period from `first` to `last`, inclusive; empty when `first` is after `last`. */
function periodsBetween(first: string, last: string): string[] {
  const periods: string[] = [];
  for (let period = first; period <= last; period = nextPeriod(period)) {
    periods.push(period);
  }
  return periods;
}

function nextPeriod(period: string): string {
  return shiftPeriod(period, 1);
}

function previousPeriod(period: string): string {
  return shiftPeriod(period, -1);
}

function min(a: string, b: string): string {
  return a < b ? a : b;
}

function max(a: string, b: string): string {
  return a > b ? a : b;
}

/** Pending, with a due date before `today`. Overdue is derived, never stored. */
function withOverdue(item: UnflaggedItem, today: string): PeriodItem {
  const overdue =
    item.status === "PENDING" && item.dueDate !== null && item.dueDate < today;
  return { ...item, overdue };
}

/** Due date ascending; items without a due date last. */
function byDueDate(a: PeriodItem, b: PeriodItem): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

function summarize(items: readonly PeriodItem[]): PeriodSummary {
  const summary: PeriodSummary = {
    inflowExpected: 0,
    inflowSettled: 0,
    outflowExpected: 0,
    outflowSettled: 0,
  };
  for (const item of items) {
    if (item.status === "SKIPPED") continue;
    const amount = item.amount ?? 0;
    if (item.direction === "INFLOW") {
      summary.inflowExpected += amount;
      if (item.status === "SETTLED") summary.inflowSettled += amount;
    } else {
      summary.outflowExpected += amount;
      if (item.status === "SETTLED") summary.outflowSettled += amount;
    }
  }
  return summary;
}

/**
 * `payload` as it reads once the occurrence `id` changes status, its overdue
 * flag and the summary derived again: what the client shows before the API
 * confirms the change (PRD §7.5). `today` is 'YYYY-MM-DD' in America/Sao_Paulo.
 */
export function withStatusChange(
  payload: PeriodPayload,
  id: string,
  change: StatusChange,
  today: string
): PeriodPayload {
  const changed = (item: PeriodItem): PeriodItem =>
    item.id !== id
      ? item
      : withOverdue(
          { ...item, ...applyStatusChange(item, change, today) },
          today
        );
  const items = payload.items.map(changed);
  return {
    period: payload.period,
    summary: summarize(items),
    items,
    overdueFromPreviousPeriods: payload.overdueFromPreviousPeriods
      .map(changed)
      .filter((item) => item.overdue),
  };
}
