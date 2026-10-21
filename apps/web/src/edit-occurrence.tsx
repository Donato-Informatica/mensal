import {
  Alert,
  Button,
  Checkbox,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import {
  clampDueDate,
  type OccurrenceEdit,
  type PeriodItem,
} from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { invalidatePeriods } from "./period-query.ts";
import { datePickerProps } from "./pickers.ts";

/**
 * `children`, as the button that opens the dialog editing `item` (PRD §5.8).
 * A virtual occurrence is materialized when saved.
 */
export function EditOccurrenceButton({
  item,
  label = `Editar ${item.description}`,
  className,
  children,
}: {
  item: PeriodItem;
  /** The button's accessible name, when it is not the row's main one. */
  label?: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <UnstyledButton
        aria-label={label}
        className={className}
        onClick={open}
        miw={0}
      >
        {children}
      </UnstyledButton>
      <Modal opened={opened} onClose={close} title="Editar conta">
        <EditOccurrenceForm item={item} onSaved={close} onCancel={close} />
      </Modal>
    </>
  );
}

function EditOccurrenceForm({
  item,
  onSaved,
  onCancel,
}: {
  item: PeriodItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const settled = item.status === "SETTLED";
  const [description, setDescription] = useState(item.description);
  const [amount, setAmount] = useState<number | string>(
    item.amount === null ? "" : item.amount / 100
  );
  const [amountToBeDefined, setAmountToBeDefined] = useState(
    item.amount === null
  );
  const [dueDate, setDueDate] = useState(item.dueDate);
  const [settledAt, setSettledAt] = useState(item.settledAt);
  const [notes, setNotes] = useState(item.notes ?? "");
  const cents = amountToBeDefined ? null : Math.round(Number(amount) * 100);

  const save = useMutation({
    mutationFn: (edit: OccurrenceEdit) => api.editOccurrence(item.id, edit),
    // A virtual occurrence comes back persisted, under an id of its own.
    onSuccess: async () => {
      await invalidatePeriods(queryClient);
      onSaved();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          description,
          amount: cents,
          dueDate,
          notes,
          ...(settled && settledAt !== null && { settledAt }),
        });
      }}
    >
      <Stack gap="md">
        {save.error && (
          <Alert color="red" variant="light">
            {errorMessage(save.error)}
          </Alert>
        )}
        <TextInput
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          maxLength={120}
          required
          data-autofocus
        />
        <SimpleGrid cols={2} spacing="md">
          <Stack gap="xs">
            <NumberInput
              label="Valor"
              value={amountToBeDefined ? "" : amount}
              onChange={setAmount}
              disabled={amountToBeDefined}
              required={!amountToBeDefined}
              withAsterisk={false}
              prefix="R$ "
              decimalSeparator=","
              thousandSeparator="."
              decimalScale={2}
              allowNegative={false}
              hideControls
            />
            {/* A settled occurrence needs its amount (PRD §5.6). */}
            {!settled && (
              <Checkbox
                label="A definir"
                checked={amountToBeDefined}
                onChange={(event) =>
                  setAmountToBeDefined(event.currentTarget.checked)
                }
              />
            )}
          </Stack>
          {/* The due date falls within the occurrence's own period. */}
          <DatePickerInput
            label="Vencimento"
            placeholder="Sem vencimento"
            value={dueDate}
            onChange={setDueDate}
            defaultDate={item.period}
            minDate={item.period}
            maxDate={clampDueDate(item.period, 31) ?? item.period}
            clearable
            clearButtonProps={{ "aria-label": "Remover vencimento" }}
            {...datePickerProps}
          />
        </SimpleGrid>
        {settled && (
          <DatePickerInput
            label="Data da liquidação"
            value={settledAt}
            onChange={(value) => {
              if (value !== null) setSettledAt(value);
            }}
            {...datePickerProps}
          />
        )}
        <Textarea
          label="Observações"
          placeholder="Opcional"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          autosize
          minRows={2}
        />
        <DialogActions>
          <Button
            variant="default"
            onClick={onCancel}
            disabled={save.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={save.isPending}
            disabled={cents !== null && !(cents > 0)}
          >
            Salvar
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}
