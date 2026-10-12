import { Button, Checkbox, NumberInput, Popover, Stack } from "@mantine/core";
import {
  today,
  withStatusChange,
  type PeriodItem,
  type StatusChange,
} from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { invalidatePeriods, updatePeriods } from "./period-query.ts";

const statusChangeKey = ["status-change"];

/**
 * Changes an occurrence's status: the screen shows it at once and rolls back
 * if the API refuses it (PRD §7.5).
 */
export function useStatusChange() {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: statusChangeKey,
    mutationFn: ({ id, change }: { id: string; change: StatusChange }) =>
      api.changeStatus(id, change),
    onMutate: ({ id, change }) =>
      updatePeriods(queryClient, (payload) =>
        withStatusChange(payload, id, change, today())
      ),
    onError: (_error, _variables, undo) => undo?.(),
    // A virtual occurrence comes back persisted, under an id of its own. Only
    // once the last change settles, so a refetch never undoes one in flight;
    // not awaited, so a failure is reported at once, not after its retries.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: statusChangeKey }) === 1) {
        void invalidatePeriods(queryClient);
      }
    },
  });
}

type OnStatusChange = (change: StatusChange) => void;

/**
 * Toggles between pending and settled with one click (PRD §7.3). An amount to
 * be defined is asked for first, in a popover that asks for nothing else.
 */
export function SettleCheckbox({
  item,
  onChange,
}: {
  item: PeriodItem;
  onChange: OnStatusChange;
}) {
  const [askingAmount, setAskingAmount] = useState(false);
  const label = `Liquidar ${item.description}`;
  return (
    <Popover
      opened={askingAmount}
      onDismiss={() => setAskingAmount(false)}
      position="bottom-start"
      trapFocus
      // Focus is trapped inside, so it stays visible even if its row scrolls away.
      hideDetached={false}
      withArrow
    >
      <Popover.Target>
        <Checkbox
          aria-label={label}
          checked={item.status === "SETTLED"}
          onChange={(event) => {
            if (!event.currentTarget.checked) onChange({ status: "PENDING" });
            else if (item.amount === null) setAskingAmount(true);
            else onChange({ status: "SETTLED" });
          }}
        />
      </Popover.Target>
      <Popover.Dropdown aria-label={label}>
        <AmountForm
          onSubmit={(amount) => {
            setAskingAmount(false);
            onChange({ status: "SETTLED", amount });
          }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

function AmountForm({ onSubmit }: { onSubmit: (cents: number) => void }) {
  const [amount, setAmount] = useState<number | string>("");
  const cents = Math.round(Number(amount) * 100);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (cents > 0) onSubmit(cents);
      }}
    >
      <Stack gap="xs">
        <NumberInput
          label="Valor"
          value={amount}
          onChange={setAmount}
          prefix="R$ "
          decimalSeparator=","
          thousandSeparator="."
          decimalScale={2}
          allowNegative={false}
          hideControls
          data-autofocus
        />
        <Button type="submit" size="xs" disabled={!(cents > 0)}>
          Liquidar
        </Button>
      </Stack>
    </form>
  );
}

/** Skips the occurrence in its period, or takes the skip back (PRD §5.7). */
export function SkipButton({
  item,
  onChange,
}: {
  item: PeriodItem;
  onChange: OnStatusChange;
}) {
  const skipped = item.status === "SKIPPED";
  const action = skipped ? "Retomar" : "Pular";
  return (
    <Button
      variant="subtle"
      color="gray"
      size="compact-xs"
      aria-label={`${action} ${item.description}`}
      onClick={() => onChange({ status: skipped ? "PENDING" : "SKIPPED" })}
    >
      {action}
    </Button>
  );
}
