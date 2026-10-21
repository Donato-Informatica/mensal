import { z } from "zod";
import { periodOfMonth, shiftPeriod } from "./period.ts";
import { periodOf } from "./today.ts";

/** A calendar date, 'YYYY-MM-DD'. */
const DateSchema = z.iso.date();

/** A period, the 1st of a month: 'YYYY-MM-01'. */
const PeriodSchema = z.iso
  .date()
  .regex(/-01$/, "A period is the 1st of a month");

/** What every amount field's description says (PRD §8.9). */
const CENTS = "integer BRL cents (R$ 50,00 = 5000)";

/** An amount in BRL cents, greater than zero. */
const AmountSchema = z.int().positive().describe(`Amount in ${CENTS}`);

/** A description the user types: not blank, at most 120 characters. */
const DescriptionInputSchema = z.string().trim().min(1).max(120);

/** Notes the user types; blank notes are no notes. */
const NotesInputSchema = z
  .string()
  .trim()
  .nullable()
  .transform((notes) => notes || null);

/**
 * The app's theme, a preference of the account (PRD §3.5): Escuro, Claro, or
 * Automático, which follows the device's own setting.
 */
export const ColorSchemeSchema = z.enum(["dark", "light", "auto"]);
export type ColorScheme = z.infer<typeof ColorSchemeSchema>;

/** A new account's theme: Escuro, so nothing changes until the user opts in. */
export const defaultColorScheme: ColorScheme = "dark";

/**
 * How the monthly screen shows its occurrences, a preference of the account
 * (PRD §3.5): Lista (grouped) or Tabela.
 */
export const OccurrenceViewSchema = z.enum(["list", "table"]);
export type OccurrenceView = z.infer<typeof OccurrenceViewSchema>;

/** A new account's view: Lista, so nothing changes until the user opts in. */
export const defaultOccurrenceView: OccurrenceView = "list";

export const DirectionSchema = z.enum(["INFLOW", "OUTFLOW"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const OccurrenceStatusSchema = z.enum(["PENDING", "SETTLED", "SKIPPED"]);
export type OccurrenceStatus = z.infer<typeof OccurrenceStatusSchema>;

export const RecurrenceSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  direction: DirectionSchema,
  description: z.string().max(120),
  defaultAmount: AmountSchema.nullable(),
  dueDay: z.int().min(1).max(31).nullable(),
  startPeriod: PeriodSchema,
  endPeriod: PeriodSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Recurrence = z.infer<typeof RecurrenceSchema>;

/** The body of `POST /recurrences`: a recurrence the user creates (PRD §3.1). */
export const NewRecurrenceSchema = z
  .object({
    direction: DirectionSchema,
    description: DescriptionInputSchema,
    defaultAmount: AmountSchema.nullable(),
    dueDay: z.int().min(1).max(31).nullable(),
    startPeriod: PeriodSchema,
    endPeriod: PeriodSchema.nullable(),
    notes: NotesInputSchema,
  })
  .refine(
    ({ startPeriod, endPeriod }) =>
      endPeriod === null || endPeriod >= startPeriod,
    { path: ["endPeriod"], message: "The end period is before the start" }
  );
export type NewRecurrence = z.output<typeof NewRecurrenceSchema>;

/**
 * The body of `PATCH /recurrences/:id`: the editable fields (PRD §6.1), each
 * left as it is when absent. Any other field, e.g. the immutable `direction`
 * and `startPeriod`, is rejected.
 */
export const RecurrenceEditSchema = z.strictObject({
  description: DescriptionInputSchema.optional(),
  defaultAmount: AmountSchema.nullable().optional(),
  dueDay: z.int().min(1).max(31).nullable().optional(),
  endPeriod: PeriodSchema.nullable().optional(),
  notes: NotesInputSchema.optional(),
});
export type RecurrenceEdit = z.output<typeof RecurrenceEditSchema>;

/**
 * The query of `GET /recurrences`: the active ones (PRD §3.1), by default, or
 * all of them.
 */
export const RecurrenceListQuerySchema = z.object({
  status: z.enum(["active", "all"]).default("active"),
});
export type RecurrenceListQuery = z.output<typeof RecurrenceListQuerySchema>;

/** The most periods one `GET /summaries` may cover (PRD §6.4). */
export const MAX_SUMMARY_PERIODS = 12;

/** A 'YYYY-MM' query parameter, as its period ('YYYY-MM-01'). */
const MonthParameterSchema = z.unknown().transform((value, context) => {
  const period = typeof value === "string" ? periodOfMonth(value) : undefined;
  if (period) return period;
  context.addIssue({ code: "custom", message: "INVALID_PERIOD" });
  return z.NEVER;
});

/**
 * The query of `GET /summaries?from&to` (PRD §6.4): two 'YYYY-MM' months, as
 * periods, at most `MAX_SUMMARY_PERIODS` apart. Each issue's message is the
 * refusal's code: `INVALID_PERIOD` for a malformed month, otherwise
 * `INVALID_PERIOD_RANGE` for a reversed or too long range.
 */
export const SummariesQuerySchema = z
  .object({ from: MonthParameterSchema, to: MonthParameterSchema })
  .refine(
    ({ from, to }) => from <= to && to < shiftPeriod(from, MAX_SUMMARY_PERIODS),
    { message: "INVALID_PERIOD_RANGE" }
  );
export type SummariesQuery = z.output<typeof SummariesQuerySchema>;

/**
 * `input` as the query of `GET /summaries`, or the code its 400 refuses it
 * with.
 */
export function parseSummariesQuery(
  input: unknown
): { query: SummariesQuery } | { code: string } {
  const result = SummariesQuerySchema.safeParse(input);
  return result.success
    ? { query: result.data }
    : { code: result.error.issues[0]!.message };
}

export const OccurrenceSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  recurrenceId: z.uuid().nullable(),
  direction: DirectionSchema,
  description: z.string().max(120),
  status: OccurrenceStatusSchema,
  amount: AmountSchema.nullable(),
  period: PeriodSchema,
  dueDate: DateSchema.nullable(),
  settledAt: DateSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Occurrence = z.infer<typeof OccurrenceSchema>;

export const VirtualOccurrenceSchema = z.object({
  id: z.string().startsWith("virtual_"),
  recurrenceId: z.uuid(),
  isVirtual: z.literal(true),
  direction: DirectionSchema,
  description: z.string().max(120),
  status: z.literal("PENDING"),
  amount: AmountSchema.nullable(),
  period: PeriodSchema,
  dueDate: DateSchema.nullable(),
  settledAt: z.null(),
  notes: z.null(),
});
export type VirtualOccurrence = z.infer<typeof VirtualOccurrenceSchema>;

/**
 * The body of `PATCH /occurrences/:id/status` (PRD §5.7). An amount may come
 * along, e.g. to settle an occurrence whose amount is to be defined; a
 * settlement date only with SETTLED, which otherwise settles it today.
 */
export const StatusChangeSchema = z
  .object({
    status: OccurrenceStatusSchema,
    amount: AmountSchema.optional(),
    settledAt: DateSchema.optional(),
  })
  .refine(
    ({ status, settledAt }) => settledAt === undefined || status === "SETTLED",
    { path: ["settledAt"], message: "Only a settled occurrence has a date" }
  );
export type StatusChange = z.output<typeof StatusChangeSchema>;

/**
 * The body of `PATCH /occurrences/:id`: the editable fields (PRD §5.8), each
 * left as it is when absent. Any other field, e.g. the immutable `direction`,
 * `period` and `recurrenceId`, is rejected.
 */
export const OccurrenceEditSchema = z.strictObject({
  description: DescriptionInputSchema.optional(),
  amount: AmountSchema.nullable().optional(),
  dueDate: DateSchema.nullable().optional(),
  settledAt: DateSchema.optional(),
  notes: NotesInputSchema.optional(),
});
export type OccurrenceEdit = z.output<typeof OccurrenceEditSchema>;

/**
 * The body of `POST /occurrences`: a one-off occurrence the user records
 * (PRD §5.9). It starts pending; its due date, if any, falls within its period.
 */
export const NewOneOffSchema = z
  .strictObject({
    direction: DirectionSchema,
    description: DescriptionInputSchema,
    amount: AmountSchema.nullable(),
    period: PeriodSchema,
    dueDate: DateSchema.nullable(),
    notes: NotesInputSchema,
  })
  .refine(
    ({ period, dueDate }) =>
      dueDate === null ||
      periodOf(dueDate) === period ||
      // An invalid period is reported alone, not as the due date's fault too.
      !PeriodSchema.safeParse(period).success,
    { path: ["dueDate"], message: "The due date is outside the period" }
  );
export type NewOneOff = z.output<typeof NewOneOffSchema>;

/** An occurrence of a period, persisted or virtual (PRD §4). */
export const PeriodItemSchema = z.object({
  id: z.string(),
  isVirtual: z.boolean(),
  recurrenceId: z.uuid().nullable(),
  direction: DirectionSchema,
  description: z.string(),
  status: OccurrenceStatusSchema,
  amount: AmountSchema.nullable(),
  period: PeriodSchema,
  dueDate: DateSchema.nullable(),
  settledAt: DateSchema.nullable(),
  notes: z.string().nullable(),
  overdue: z.boolean(),
});

/** A total in BRL cents. */
const TotalSchema = z.int().describe(`Total in ${CENTS}`);

/** Totals in BRL cents per direction; skipped occurrences never count. */
export const PeriodSummarySchema = z.object({
  inflowExpected: TotalSchema,
  inflowSettled: TotalSchema,
  outflowExpected: TotalSchema,
  outflowSettled: TotalSchema,
});

/** The body of `GET /periods/:yyyy-mm` (PRD §4, §6.2). */
export const PeriodPayloadSchema = z.object({
  period: PeriodSchema,
  summary: PeriodSummarySchema,
  items: z.array(PeriodItemSchema),
  overdueFromPreviousPeriods: z.array(PeriodItemSchema),
});

/** The body of `GET /summaries?from&to`: each period's summary, ascending (PRD §6.4). */
export const SummariesPayloadSchema = z.object({
  items: z.array(
    z.object({ period: PeriodSchema, summary: PeriodSummarySchema })
  ),
});

/** The longest name an access token can have (PRD §8.9). */
export const MAX_ACCESS_TOKEN_NAME_LENGTH = 32;

/**
 * An access token as the list shows it (PRD §8.9): never its secret, only the
 * `prefix` that tells tokens apart.
 */
export const AccessTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type AccessToken = z.infer<typeof AccessTokenSchema>;

/** A new access token: the only response that carries the full `token`. */
export const CreatedAccessTokenSchema = AccessTokenSchema.extend({
  token: z.string(),
});
export type CreatedAccessToken = z.infer<typeof CreatedAccessTokenSchema>;

/** The body of `POST /access-tokens`. */
export const NewAccessTokenSchema = z.strictObject({
  name: z.string().trim().min(1).max(MAX_ACCESS_TOKEN_NAME_LENGTH),
  currentPassword: z.string().min(1),
});
export type NewAccessToken = z.output<typeof NewAccessTokenSchema>;
