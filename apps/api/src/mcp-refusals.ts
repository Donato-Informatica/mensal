/**
 * For each refusal code an MCP tool can answer with, the one English sentence
 * that explains the rule and the way forward (PRD §8.9). A code missing here
 * gets a generic sentence, so add one with every new code.
 */
const sentences: Record<string, string> = {
  INVALID_PERIOD:
    "The period is not a valid month; use the format YYYY-MM, e.g. 2026-10.",
  INVALID_PERIOD_RANGE:
    "from must not be after to, and the range covers at most 12 periods; narrow it and try again.",
  RECURRENCE_NOT_FOUND:
    "You have no recurrence with this id; list your recurrences with list_recurrences to find it.",
  OCCURRENCE_NOT_FOUND:
    "You have no occurrence with this id; read the period with get_period to find its id.",
  RECURRENCE_HAS_OCCURRENCES:
    "This recurrence has occurrences; end it instead with update_recurrence and an endPeriod.",
  ONLY_ONE_OFF_DELETABLE:
    "Only a one-off occurrence can be deleted; skip this one with change_occurrence_status instead.",
  AMOUNT_REQUIRED_TO_SETTLE:
    "A settled occurrence needs an amount; pass the amount in integer BRL cents.",
  START_PERIOD_IN_PAST:
    "A recurrence cannot start before the current period; record earlier history as one-off occurrences.",
  END_PERIOD_BEFORE_START:
    "The end period is before the recurrence's start period; pick the start period or a later one.",
  DUE_DATE_OUTSIDE_PERIOD:
    "The due date must fall within the occurrence's period.",
  OCCURRENCE_NOT_SETTLED:
    "Only a settled occurrence has a settlement date; settle it first with change_occurrence_status.",
};

/** The sentence explaining a refusal; `fields` are those an INVALID_INPUT names. */
export function explain(code: string, fields?: string[]): string {
  if (code === "INVALID_INPUT") {
    return fields && fields.length > 0
      ? `These arguments are missing or invalid: ${fields.join(", ")}; fix them according to the tool's input schema and call it again.`
      : "The arguments are invalid; fix them according to the tool's input schema and call it again.";
  }
  return sentences[code] ?? `The request was refused (${code}).`;
}
