import {
  Alert,
  Button,
  Checkbox,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import type { Recurrence, RecurrenceEdit } from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { errorMessage } from "./api-error.ts";
import { formatPeriodInline } from "./format.ts";
import { invalidatePeriods } from "./period-query.ts";
import { monthPickerProps } from "./pickers.ts";
import { invalidateRecurrences } from "./recurrence-query.ts";

/** `children`, as the button that opens the dialog editing `recurrence`. */
export function EditRecurrenceButton({
  recurrence,
  children,
}: {
  recurrence: Recurrence;
  children: ReactNode;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <UnstyledButton
        aria-label={`Editar ${recurrence.description}`}
        onClick={open}
        miw={0}
      >
        {children}
      </UnstyledButton>
      <Modal opened={opened} onClose={close} title="Editar recorrência">
        <EditRecurrenceForm recurrence={recurrence} onSaved={close} />
      </Modal>
    </>
  );
}

/**
 * Edits the recurrence's editable fields (PRD §6.1). Its virtual occurrences
 * follow; the ones already persisted keep their snapshot (PRD §5.3).
 */
export function EditRecurrenceForm({
  recurrence,
  onSaved,
}: {
  recurrence: Recurrence;
  onSaved: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(recurrence.description);
  const [amount, setAmount] = useState<number | string>(
    recurrence.defaultAmount === null ? "" : recurrence.defaultAmount / 100
  );
  const [amountToBeDefined, setAmountToBeDefined] = useState(
    recurrence.defaultAmount === null
  );
  const [dueDay, setDueDay] = useState<number | string>(
    recurrence.dueDay ?? ""
  );
  const [endPeriod, setEndPeriod] = useState(recurrence.endPeriod);
  const [notes, setNotes] = useState(recurrence.notes ?? "");

  const save = useMutation({
    mutationFn: (edit: RecurrenceEdit) =>
      api.editRecurrence(recurrence.id, edit),
    // Its virtual occurrences change in every period.
    onSuccess: async () => {
      await Promise.all([
        invalidateRecurrences(queryClient),
        invalidatePeriods(queryClient),
      ]);
      onSaved();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          description,
          defaultAmount: amountToBeDefined
            ? null
            : Math.round(Number(amount) * 100),
          dueDay: dueDay === "" ? null : Number(dueDay),
          endPeriod,
          notes,
        });
      }}
    >
      <Stack gap="md">
        {save.error && (
          <Alert color="red" variant="light">
            {errorMessage(save.error)}
          </Alert>
        )}
        {/* The direction and the start never change. */}
        <Text fz="sm" c="dimmed">
          {recurrence.direction === "INFLOW" ? "Entrada" : "Saída"} desde{" "}
          {formatPeriodInline(recurrence.startPeriod)}. As contas já liquidadas,
          puladas ou editadas ficam como estão.
        </Text>
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
            <Checkbox
              label="A definir"
              checked={amountToBeDefined}
              onChange={(event) =>
                setAmountToBeDefined(event.currentTarget.checked)
              }
            />
          </Stack>
          <NumberInput
            label="Dia do vencimento"
            placeholder="Opcional"
            value={dueDay}
            onChange={setDueDay}
            min={1}
            max={31}
            allowDecimal={false}
            allowNegative={false}
            hideControls
          />
        </SimpleGrid>
        <MonthPickerInput
          label="Término"
          placeholder="Sem término"
          value={endPeriod}
          onChange={setEndPeriod}
          minDate={recurrence.startPeriod}
          clearable
          clearButtonProps={{ "aria-label": "Remover término" }}
          {...monthPickerProps}
        />
        <Textarea
          label="Observações"
          placeholder="Opcional"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Button type="submit" loading={save.isPending} fullWidth mt="xs">
          Salvar
        </Button>
      </Stack>
    </form>
  );
}
