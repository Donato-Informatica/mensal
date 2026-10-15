import { Alert, Button, Stack, Text } from "@mantine/core";
import type { Recurrence } from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { ApiError, errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { invalidatePeriods } from "./period-query.ts";
import { invalidateRecurrenceLists } from "./recurrence-query.ts";

/**
 * Deletes a recurrence without history for good, once confirmed. One with
 * persisted occurrences is refused, and ending it is offered instead
 * (PRD §5.4).
 */
export function ConfirmRecurrenceDeletion({
  recurrence,
  onCancel,
  onDeleted,
  onEndInstead,
}: {
  recurrence: Recurrence;
  onCancel: () => void;
  onDeleted: () => void;
  onEndInstead: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.deleteRecurrence(recurrence.id),
    // Its virtual occurrences go with it, in every period.
    onSuccess: async () => {
      await Promise.all([
        invalidateRecurrenceLists(queryClient),
        invalidatePeriods(queryClient),
      ]);
      onDeleted();
    },
  });

  const hasHistory =
    remove.error instanceof ApiError &&
    remove.error.code === "RECURRENCE_HAS_OCCURRENCES";

  if (hasHistory) {
    return (
      <Stack gap="md">
        <Alert color="gray" variant="light">
          {errorMessage(remove.error)}
        </Alert>
        <DialogActions>
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onEndInstead} data-autofocus>
            Encerrar recorrência
          </Button>
        </DialogActions>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {remove.error && (
        <Alert color="red" variant="light">
          {errorMessage(remove.error)}
        </Alert>
      )}
      <Text>
        <Text span fw={600} c="white">
          {recurrence.description}
        </Text>{" "}
        será excluída. Isso não pode ser desfeito.
      </Text>
      <DialogActions>
        <Button variant="default" onClick={onCancel} data-autofocus>
          Cancelar
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          Excluir
        </Button>
      </DialogActions>
    </Stack>
  );
}
