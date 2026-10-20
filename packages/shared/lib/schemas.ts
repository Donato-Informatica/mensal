import { z } from "zod";
import { periodOf } from "./today.ts";

/** A calendar date, 'YYYY-MM-DD'. */
const DateSchema = z.iso.date();

/** A period, the 1st of a month: 'YYYY-MM-01'. */
const PeriodSchema = z.iso
  .date()
  .regex(/-01$/, "A period is the 1st of a month");

/** An amount in BRL cents, greater than zero. */
const AmountSchema = z.int().positive();

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

/** Totals in BRL cents per direction; skipped occurrences never count. */
export const PeriodSummarySchema = z.object({
  inflowExpected: z.int(),
  inflowSettled: z.int(),
  outflowExpected: z.int(),
  outflowSettled: z.int(),
});

/** The body of `GET /periods/:yyyy-mm` (PRD §4, §6.2). */
export const PeriodPayloadSchema = z.object({
  period: PeriodSchema,
  summary: PeriodSummarySchema,
  items: z.array(PeriodItemSchema),
  overdueFromPreviousPeriods: z.array(PeriodItemSchema),
});
