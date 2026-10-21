import {
  NewOneOffSchema,
  NewRecurrenceSchema,
  OccurrenceEditSchema,
  OccurrenceSchema,
  RecurrenceEditSchema,
  RecurrenceSchema,
  StatusChangeSchema,
} from "@mensal/shared";
import { z } from "zod";
import { defineTool } from "./mcp-tool.ts";
import {
  changeOccurrenceStatus,
  createOneOff,
  createRecurrence,
  deleteOccurrence,
  deleteRecurrence,
  editOccurrence,
  editRecurrence,
} from "./operations.ts";

const Deleted = z.object({ deleted: z.literal(true) });

/**
 * An occurrence as a write answers: persisted, or, when the write changed
 * nothing, the virtual one as it was (ADR-0001).
 */
const OccurrenceResult = OccurrenceSchema.pick({
  recurrenceId: true,
  direction: true,
  description: true,
  status: true,
  amount: true,
  period: true,
  dueDate: true,
  settledAt: true,
  notes: true,
}).extend({
  id: z.string(),
  isVirtual: z.literal(true).optional(),
});

const OccurrenceId = z
  .string()
  .describe(
    "The occurrence's id: a UUID, or a virtual id (virtual_<recurrenceId>_<period>) as get_period returns it, which this materializes."
  );

const RecurrenceId = z.string().describe("The recurrence's id (a UUID).");

/** The write tools of PRD §8.9; each logs its activity with `"via":"mcp"`. */
export const writeTools = [
  defineTool({
    name: "create_recurrence",
    operation: "POST /api/v1/recurrences",
    title: "Create a recurrence",
    description:
      "Creates a Recurrence (Recorrência), a monthly commitment that gives rise to one occurrence per Period (Competência). The start period (YYYY-MM-01) cannot be before the current period (rule 5.10; record earlier history with create_one_off). Amounts are integer BRL cents; defaultAmount may be null when the amount varies.",
    annotations: {},
    input: NewRecurrenceSchema,
    output: RecurrenceSchema,
    run: (context, input) => createRecurrence(context, input),
  }),
  defineTool({
    name: "update_recurrence",
    operation: "PATCH /api/v1/recurrences/{id}",
    title: "Update a recurrence",
    description:
      "Edits a Recurrence (Recorrência): description, defaultAmount, dueDay (Vencimento), endPeriod and notes; direction and startPeriod cannot change. Its virtual occurrences follow the change, while persisted ones keep their snapshot (rule 5.3). Ending a recurrence is setting endPeriod (YYYY-MM-01, inclusive; the current period if the user gave none, rule 5.4): nothing is deleted, persisted occurrences stay and virtual ones stop after it. endPeriod cannot be before the start.",
    annotations: {},
    input: RecurrenceEditSchema.extend({ id: RecurrenceId }),
    output: RecurrenceSchema,
    run: (context, { id, ...edit }) => editRecurrence(context, id, edit),
  }),
  defineTool({
    name: "delete_recurrence",
    operation: "DELETE /api/v1/recurrences/{id}",
    title: "Delete a recurrence",
    description:
      "Deletes a Recurrence (Recorrência) for good. Only one without persisted occurrences can be deleted; otherwise it is refused with RECURRENCE_HAS_OCCURRENCES and must be ended with update_recurrence and an endPeriod instead (rule 5.4).",
    annotations: { destructiveHint: true },
    input: z.object({ id: RecurrenceId }),
    output: Deleted,
    async run(context, { id }) {
      await deleteRecurrence(context, id);
      return { deleted: true };
    },
  }),
  defineTool({
    name: "create_one_off",
    operation: "POST /api/v1/occurrences",
    title: "Create a one-off occurrence",
    description:
      "Creates a One-off occurrence (Avulsa), an occurrence of a single Period (Competência) that belongs to no recurrence; it starts pending (rule 5.9). Use it also for history before the current period. dueDate, if any, must fall within the period. Amounts are integer BRL cents.",
    annotations: {},
    input: NewOneOffSchema,
    output: OccurrenceResult,
    run: (context, input) => createOneOff(context, input),
  }),
  defineTool({
    name: "update_occurrence",
    operation: "PATCH /api/v1/occurrences/{id}",
    title: "Update an occurrence",
    description:
      "Edits an Occurrence (Ocorrência), persisted or virtual (a virtual id is materialized by the first change, rule 5.2): description, amount, dueDate (within its period), settledAt (only while Settled = Liquidada) and notes. direction, period and recurrence are immutable; to move a one-off to another period, delete it and create it again (rule 5.8). To settle, use change_occurrence_status.",
    annotations: {},
    input: OccurrenceEditSchema.extend({ id: OccurrenceId }),
    output: OccurrenceResult,
    run: (context, { id, ...edit }) => editOccurrence(context, id, edit),
  }),
  defineTool({
    name: "change_occurrence_status",
    operation: "PATCH /api/v1/occurrences/{id}/status",
    title: "Change an occurrence's status",
    description:
      'Changes the status of an Occurrence (Ocorrência), persisted or virtual (a virtual id is materialized, rule 5.2), to PENDING (Pendente), SETTLED (Liquidada) or SKIPPED (Ignorada); any transition is allowed (rule 5.7). "Settle (Liquidar)" needs an amount above zero, optionally passed here, otherwise set with update_occurrence first; settledAt (YYYY-MM-DD, only with SETTLED) defaults to today. Leaving SETTLED clears settledAt. An occurrence from a recurrence cannot be deleted: skip it with SKIPPED.',
    annotations: {},
    input: z
      .object({ id: OccurrenceId, ...StatusChangeSchema.shape })
      .refine(
        ({ status, settledAt }) =>
          settledAt === undefined || status === "SETTLED",
        { path: ["settledAt"], message: "Only a settled occurrence has a date" }
      ),
    output: OccurrenceResult,
    run: (context, { id, ...change }) =>
      changeOccurrenceStatus(context, id, change),
  }),
  defineTool({
    name: "delete_occurrence",
    operation: "DELETE /api/v1/occurrences/{id}",
    title: "Delete an occurrence",
    description:
      "Deletes a One-off occurrence (Avulsa) for good. An occurrence that comes from a recurrence cannot be deleted (rule 5.9): it is refused with ONLY_ONE_OFF_DELETABLE and must be skipped with change_occurrence_status and SKIPPED instead.",
    annotations: { destructiveHint: true },
    input: z.object({
      id: z.string().describe("The occurrence's id (a UUID)."),
    }),
    output: Deleted,
    async run(context, { id }) {
      await deleteOccurrence(context, id);
      return { deleted: true };
    },
  }),
];
