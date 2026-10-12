import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PeriodItem } from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { errorMessage } from "./api-error.ts";
import { invalidatePeriods } from "./period-query.ts";

/**
 * Deletes a one-off occurrence for good, once confirmed (PRD §5.9). One of a
 * recurrence is skipped instead, so it gets no such button.
 */
export function DeleteOneOffButton({ item }: { item: PeriodItem }) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button
        variant="subtle"
        color="gray"
        size="compact-xs"
        aria-label={`Excluir ${item.description}`}
        onClick={open}
      >
        Excluir
      </Button>
      <Modal opened={opened} onClose={close} title="Excluir conta" centered>
        <ConfirmDeletion item={item} onCancel={close} onDeleted={close} />
      </Modal>
    </>
  );
}

function ConfirmDeletion({
  item,
  onCancel,
  onDeleted,
}: {
  item: PeriodItem;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.deleteOneOff(item.id),
    onSuccess: async () => {
      await invalidatePeriods(queryClient);
      onDeleted();
    },
  });

  return (
    <Stack gap="md">
      {remove.error && (
        <Alert color="red" variant="light">
          {errorMessage(remove.error)}
        </Alert>
      )}
      <Text>
        <Text span fw={600} c="white">
          {item.description}
        </Text>{" "}
        será excluída. Isso não pode ser desfeito.
      </Text>
      <Group justify="flex-end" gap="sm">
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
      </Group>
    </Stack>
  );
}
