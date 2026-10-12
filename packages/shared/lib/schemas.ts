import { z } from "zod";

/** A calendar date, 'YYYY-MM-DD'. */
const DateSchema = z.iso.date();

/** A period, the 1st of a month: 'YYYY-MM-01'. */
const PeriodSchema = z.iso
  .date()
  .regex(/-01$/, "A period is the 1st of a month");

/** An amount in BRL cents, greater than zero. */
const AmountSchema = z.int().positive();

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
    description: z.string().trim().min(1).max(120),
    defaultAmount: AmountSchema.nullable(),
    dueDay: z.int().min(1).max(31).nullable(),
    startPeriod: PeriodSchema,
    endPeriod: PeriodSchema.nullable(),
    // Blank notes are no notes.
    notes: z
      .string()
      .trim()
      .nullable()
      .transform((notes) => notes || null),
  })
  .refine(
    ({ startPeriod, endPeriod }) =>
      endPeriod === null || endPeriod >= startPeriod,
    { path: ["endPeriod"], message: "The end period is before the start" }
  );
export type NewRecurrence = z.output<typeof NewRecurrenceSchema>;

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
  description: z.string().trim().min(1).max(120).optional(),
  amount: AmountSchema.nullable().optional(),
  dueDate: DateSchema.nullable().optional(),
  settledAt: DateSchema.optional(),
  // Blank notes are no notes.
  notes: z
    .string()
    .trim()
    .nullable()
    .transform((notes) => notes || null)
    .optional(),
});
export type OccurrenceEdit = z.output<typeof OccurrenceEditSchema>;
