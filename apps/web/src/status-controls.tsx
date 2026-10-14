import {
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  NumberInput,
  Popover,
  Stack,
  Text,
} from "@mantine/core";
import {
  today,
  withStatusChange,
  type PeriodItem,
  type StatusChange,
} from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { formatAmount, formatPeriodInline } from "./format.ts";
import classes from "./touch.module.css";
import { invalidatePeriods, updatePeriods } from "./period-query.ts";

const statusChangeKey = ["status-change"];

/**
 * Changes an occurrence's status: the screen shows it at once and rolls back
 * if the API refuses it (PRD §7.5), telling `onFailure` which change it was.
 */
export function useStatusChange({
  onFailure,
}: {
  onFailure?: (request: StatusChangeRequest, error: unknown) => void;
} = {}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: statusChangeKey,
    mutationFn: ({ item, change }: StatusChangeRequest) =>
      api.changeStatus(item.id, change),
    onMutate: ({ item, change }) =>
      updatePeriods(queryClient, (payload) =>
        withStatusChange(payload, item.id, change, today())
      ),
    onError: (error, request, undo) => {
      undo?.();
      onFailure?.(request, error);
    },
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
  const settled = item.status === "SETTLED";
  const label = settled
    ? `Desfazer liquidação de ${item.description}`
    : `Liquidar ${item.description}`;
  return (
    <label className={classes.settle}>
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
            checked={settled}
            onChange={(event) => {
              if (!event.currentTarget.checked) onChange({ status: "PENDING" });
              else if (item.amount === null) setAskingAmount(true);
              else onChange({ status: "SETTLED" });
            }}
          />
        </Popover.Target>
        <Popover.Dropdown aria-label={`Liquidar ${item.description}`}>
          <AmountForm
            onSubmit={(amount) => {
              setAskingAmount(false);
              onChange({ status: "SETTLED", amount });
            }}
          />
        </Popover.Dropdown>
      </Popover>
    </label>
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
        <Button
          type="submit"
          size="xs"
          className={classes.button}
          disabled={!(cents > 0)}
        >
          Liquidar
        </Button>
      </Stack>
    </form>
  );
}

/**
 * Skips the occurrence in its period, or takes the skip back (PRD §5.7): an
 * item of the row's "Mais ações" menu.
 */
export function SkipMenuItem({
  item,
  onChange,
}: {
  item: PeriodItem;
  onChange: OnStatusChange;
}) {
  const skipped = item.status === "SKIPPED";
  return (
    <Menu.Item
      onClick={() => onChange({ status: skipped ? "PENDING" : "SKIPPED" })}
    >
      {skipped ? "Retomar" : "Pular"}
    </Menu.Item>
  );
}

/** A status change on hold until it is confirmed. */
export type StatusChangeRequest = { item: PeriodItem; change: StatusChange };

/**
 * Whether a change waits for confirmation: all but settling with an amount
 * just typed in, which was deliberate enough.
 */
export function needsConfirmation(change: StatusChange): boolean {
  return !(change.status === "SETTLED" && change.amount !== undefined);
}

/** Asks before settling, skipping or taking an occurrence back to pending. */
export function ConfirmStatusChange({
  request,
  onConfirm,
  onCancel,
}: {
  request: StatusChangeRequest | null;
  onConfirm: (request: StatusChangeRequest) => void;
  onCancel: () => void;
}) {
  // Kept while the modal fades out, so its text does not vanish first.
  const [shown, setShown] = useState(request);
  if (request !== null && request !== shown) setShown(request);
  const copy = shown && confirmationCopy(shown);
  return (
    <Modal
      opened={request !== null}
      onClose={onCancel}
      title={copy?.title}
      centered
    >
      {shown && copy && (
        <Stack gap="md">
          <Text>
            <Text span fw={600} c="white">
              {shown.item.description}
            </Text>{" "}
            {copy.text}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={() => onConfirm(shown)} data-autofocus>
              {copy.action}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function confirmationCopy({ item, change }: StatusChangeRequest) {
  switch (change.status) {
    case "SETTLED":
      return {
        title: "Liquidar conta",
        text: `será liquidada por ${formatAmount(change.amount ?? item.amount ?? 0)}.`,
        action: "Liquidar",
      };
    case "SKIPPED":
      return {
        title: "Pular conta",
        text: `será pulada em ${formatPeriodInline(item.period)}.`,
        action: "Pular",
      };
    // Named after the control that asked for it: "Retomar" in the menu, the
    // checkbox otherwise.
    case "PENDING":
      return item.status === "SKIPPED"
        ? {
            title: "Retomar conta",
            text: "deixará de ser pulada e voltará a ficar pendente.",
            action: "Retomar",
          }
        : {
            title: "Voltar para pendente",
            text: "deixará de estar liquidada e voltará a ficar pendente.",
            action: "Voltar para pendente",
          };
  }
}
