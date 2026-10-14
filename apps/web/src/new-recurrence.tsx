import {
  Alert,
  Button,
  Checkbox,
  Modal,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import {
  currentPeriod,
  type Direction,
  type NewRecurrence,
} from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "./api-error.ts";
import { invalidatePeriods } from "./period-query.ts";
import { monthPickerProps } from "./pickers.ts";
import { invalidateRecurrences } from "./recurrence-query.ts";

/** "Nova recorrência": opens the dialog that creates a recurrence (PRD §7.7). */
export function NewRecurrenceButton() {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button onClick={open}>Nova recorrência</Button>
      <Modal opened={opened} onClose={close} title="Nova recorrência" centered>
        <NewRecurrenceForm onCreated={close} />
      </Modal>
    </>
  );
}

/** The form starts on the current period (PRD §5.10: never earlier). */
function NewRecurrenceForm({ onCreated }: { onCreated: () => void }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<Direction>("OUTFLOW");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [amountToBeDefined, setAmountToBeDefined] = useState(false);
  const [dueDay, setDueDay] = useState<number | string>("");
  // A recurrence never starts before the current period (PRD §5.10).
  const earliestStart = currentPeriod();
  const [startPeriod, setStartPeriod] = useState(earliestStart);
  const [endPeriod, setEndPeriod] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: (recurrence: NewRecurrence) => api.createRecurrence(recurrence),
    // Its virtual occurrences reach every period from its start on.
    onSuccess: async () => {
      await Promise.all([
        invalidatePeriods(queryClient),
        invalidateRecurrences(queryClient),
      ]);
      onCreated();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({
          direction,
          description,
          defaultAmount: amountToBeDefined
            ? null
            : Math.round(Number(amount) * 100),
          dueDay: dueDay === "" ? null : Number(dueDay),
          startPeriod,
          endPeriod,
          notes,
        });
      }}
    >
      <Stack gap="md">
        {create.error && (
          <Alert color="red" variant="light">
            {errorMessage(create.error)}
          </Alert>
        )}
        <SegmentedControl
          aria-label="Tipo"
          fullWidth
          value={direction}
          onChange={(value) => setDirection(value as Direction)}
          data={[
            { label: "Saída", value: "OUTFLOW" },
            { label: "Entrada", value: "INFLOW" },
          ]}
        />
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
        <SimpleGrid cols={2} spacing="md">
          <MonthPickerInput
            label="Início"
            value={startPeriod}
            onChange={(value) => {
              if (value === null) return;
              setStartPeriod(value);
              if (endPeriod !== null && endPeriod < value) setEndPeriod(null);
            }}
            minDate={earliestStart}
            {...monthPickerProps}
          />
          <MonthPickerInput
            label="Término"
            placeholder="Sem término"
            value={endPeriod}
            onChange={setEndPeriod}
            minDate={startPeriod}
            clearable
            clearButtonProps={{ "aria-label": "Remover término" }}
            {...monthPickerProps}
          />
        </SimpleGrid>
        <Textarea
          label="Observações"
          placeholder="Opcional"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Button type="submit" loading={create.isPending} fullWidth mt="xs">
          Criar recorrência
        </Button>
      </Stack>
    </form>
  );
}
