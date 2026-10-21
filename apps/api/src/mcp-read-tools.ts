import {
  PeriodPayloadSchema,
  RecurrenceListQuerySchema,
  RecurrenceSchema,
  SummariesPayloadSchema,
  currentPeriod,
  monthOf,
} from "@mensal/shared";
import { z } from "zod";
import { defineTool, withToday } from "./mcp-tool.ts";
import {
  getRecurrence,
  listRecurrences,
  readPeriod,
  readSummaries,
} from "./operations.ts";

const Today = z
  .string()
  .describe("Today's date (YYYY-MM-DD) in America/Sao_Paulo.");

/** The read tools of PRD §8.9; none changes anything. */
export const readTools = [
  defineTool({
    name: "get_period",
    title: "Get a period",
    description:
      "Reads one Period (Competência): its summary (Expected = Previsto and Settled = Realizado totals per direction, Inflow = Entrada and Outflow = Saída), its occurrences (Ocorrências, persisted and Virtual occurrences merged) and, for the current period only, the Overdue (Atrasada) occurrences from earlier periods. Defaults to the current period (Mês atual). Reading never changes anything.",
    annotations: { readOnlyHint: true },
    input: z.object({
      period: z
        .string()
        .optional()
        .describe(
          "Period (Competência) as YYYY-MM, e.g. 2026-10. Defaults to the current period."
        ),
    }),
    output: PeriodPayloadSchema.extend({ today: Today }),
    async run(context, { period }) {
      const month = period ?? monthOf(currentPeriod(context.now()));
      return withToday(context, await readPeriod(context, month));
    },
  }),
  defineTool({
    name: "get_trend",
    title: "Get the trend",
    description:
      "Reads the Trend (Evolução): the summary of every Period (Competência) from `from` to `to`, both inclusive and in ascending order, with zeros for a period without occurrences. At most 12 periods; future periods are allowed. Overdue (Atrasada) occurrences from earlier periods never enter a summary. Reading never changes anything.",
    annotations: { readOnlyHint: true },
    input: z.object({
      from: z.string().describe("First period, as YYYY-MM."),
      to: z.string().describe("Last period, as YYYY-MM; not before `from`."),
    }),
    output: SummariesPayloadSchema.extend({ today: Today }),
    async run(context, query) {
      return withToday(context, await readSummaries(context, query));
    },
  }),
  defineTool({
    name: "list_recurrences",
    title: "List recurrences",
    description:
      "Lists the Recurrences (Recorrências), monthly commitments that give rise to one occurrence per Period (Competência), ordered by description. `active` (default) leaves out those ended before the current period; `all` includes them. Reading never changes anything.",
    annotations: { readOnlyHint: true },
    input: RecurrenceListQuerySchema,
    output: z.object({ items: z.array(RecurrenceSchema), today: Today }),
    async run(context, query) {
      return withToday(context, {
        items: await listRecurrences(context, query),
      });
    },
  }),
  defineTool({
    name: "get_recurrence",
    title: "Get a recurrence",
    description:
      "Reads one Recurrence (Recorrência) by id: direction (Entrada or Saída), description, default amount, due day (Vencimento), start and end Period (Competência) and notes. Reading never changes anything.",
    annotations: { readOnlyHint: true },
    input: z.object({
      id: z.string().describe("The recurrence's id (a UUID)."),
    }),
    output: RecurrenceSchema.extend({ today: Today }),
    async run(context, { id }) {
      return withToday(context, await getRecurrence(context, id));
    },
  }),
];
