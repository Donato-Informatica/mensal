import { Alert, Button, Stack, Text } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { currentPeriod, type Recurrence } from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { invalidatePeriods } from "./period-query.ts";
import { monthPickerProps } from "./pickers.ts";
import { invalidateRecurrences } from "./recurrence-query.ts";

/**
 * Ends the recurrence after the last period picked (PRD §5.4): it is no
 * longer projected later on, and nothing persisted is deleted.
 */
export function EndRecurrenceForm({
  recurrence,
  onEnded,
  onCancel,
}: {
  recurrence: Recurrence;
  onEnded: () => void;
  onCancel: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const [endPeriod, setEndPeriod] = useState<string | null>(() =>
    defaultEndPeriod(recurrence, currentPeriod())
  );

  const end = useMutation({
    mutationFn: (period: string) =>
      api.editRecurrence(recurrence.id, { endPeriod: period }),
    // Its virtual occurrences after the end go away.
    onSuccess: async () => {
      await Promise.all([
        invalidateRecurrences(queryClient),
        invalidatePeriods(queryClient),
      ]);
      onEnded();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (endPeriod) end.mutate(endPeriod);
      }}
    >
      <Stack gap="md">
        {end.error && (
          <Alert color="red" variant="light">
            {errorMessage(end.error)}
          </Alert>
        )}
        <Text>
          <Text span fw={600} c="bright">
            {recurrence.description}
          </Text>{" "}
          deixa de aparecer depois do último mês. As contas já registradas ficam
          como estão, mesmo as de meses seguintes.
        </Text>
        <MonthPickerInput
          label="Último mês"
          value={endPeriod}
          onChange={setEndPeriod}
          minDate={recurrence.startPeriod}
          required
          withAsterisk={false}
          {...monthPickerProps}
        />
        <DialogActions>
          <Button variant="default" onClick={onCancel} disabled={end.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={end.isPending}>
            Encerrar
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}

/**
 * The current period (PRD §5.4), or the start for a recurrence starting
 * later; never past an end already set, so ending never extends it.
 */
function defaultEndPeriod(
  { startPeriod, endPeriod }: Recurrence,
  current: string
): string {
  const period = current < startPeriod ? startPeriod : current;
  return endPeriod !== null && endPeriod < period ? endPeriod : period;
}
