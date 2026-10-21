import {
  Alert,
  Button,
  Checkbox,
  Modal,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { clampDueDate, type Direction, type NewOneOff } from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { formatPeriod } from "./format.ts";
import { invalidatePeriods } from "./period-query.ts";
import { datePickerProps } from "./pickers.ts";
import { PrimaryActionButton } from "./primary-action-button.tsx";

/** "Nova avulsa": opens the dialog that records a one-off occurrence (PRD §7.7). */
export function NewOneOffButton({ period }: { period: string }) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <PrimaryActionButton onClick={open}>Nova avulsa</PrimaryActionButton>
      <Modal opened={opened} onClose={close} title="Nova conta avulsa">
        <NewOneOffForm period={period} onCreated={close} onCancel={close} />
      </Modal>
    </>
  );
}

/**
 * The one-off goes in `period` ('YYYY-MM-01'), the month on screen; an earlier
 * one too, which is how history is entered (PRD §5.10).
 */
function NewOneOffForm({
  period,
  onCreated,
  onCancel,
}: {
  period: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<Direction>("OUTFLOW");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [amountToBeDefined, setAmountToBeDefined] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const cents = amountToBeDefined ? null : Math.round(Number(amount) * 100);

  const create = useMutation({
    mutationFn: (oneOff: NewOneOff) => api.createOneOff(oneOff),
    onSuccess: async () => {
      await invalidatePeriods(queryClient);
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
          amount: cents,
          period,
          dueDate,
          notes,
        });
      }}
    >
      <Stack gap="md">
        <Text fz="sm" c="dimmed">
          Em {formatPeriod(period)}
        </Text>
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
          {/* The due date falls within the one-off's period. */}
          <DatePickerInput
            label="Vencimento"
            placeholder="Sem vencimento"
            value={dueDate}
            onChange={setDueDate}
            defaultDate={period}
            minDate={period}
            maxDate={clampDueDate(period, 31) ?? period}
            clearable
            clearButtonProps={{ "aria-label": "Remover vencimento" }}
            {...datePickerProps}
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
        <DialogActions>
          <Button
            variant="default"
            onClick={onCancel}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={cents !== null && !(cents > 0)}
          >
            Criar conta
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}
