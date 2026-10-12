import type { Occurrence, StatusChange } from "./schemas.ts";

type StatusFields = Pick<Occurrence, "status" | "amount" | "settledAt">;

/**
 * An occurrence's status, amount and settlement date once `change` applies
 * (PRD §5.7): the amount sent replaces its own; settling dates it today unless
 * a date is sent or it was already settled; leaving SETTLED clears the date.
 * Whether the result may be settled at all (it needs an amount) is the
 * caller's to check. `today` is 'YYYY-MM-DD' in America/Sao_Paulo.
 */
export function applyStatusChange(
  occurrence: Pick<Occurrence, "amount" | "settledAt">,
  { status, amount, settledAt }: StatusChange,
  today: string
): StatusFields {
  return {
    status,
    amount: amount ?? occurrence.amount,
    settledAt:
      status === "SETTLED"
        ? (settledAt ?? occurrence.settledAt ?? today)
        : null,
  };
}
