import { Alert, Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import type { ApiClient } from "./api-client.ts";
import { errorMessage } from "./api-error.ts";
import { currentPushRegistration, registerForPush } from "./browser-push.ts";
import { DialogActions } from "./dialog-actions.tsx";

const remindersKey = ["reminders"];

/**
 * Reminders on this device (PRD §7.19): off, on, or not configured on this
 * server at all.
 */
type DeviceState =
  { name: "unavailable" } | { name: "off"; publicKey: string } | { name: "on" };

/**
 * The "Lembretes" modal, opened from the account menu (PRD §7.19): turns
 * reminders (§6.8) on for the device the user is on.
 */
export function RemindersModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Lembretes">
      <RemindersScreen onClose={onClose} />
    </Modal>
  );
}

/**
 * This device's state, read whenever the screen opens. It comes from the
 * server (`POST /device/check`), never from the browser's registration
 * alone; one the server says is not the user's is dropped (PRD §8.2).
 */
async function readDeviceState(api: ApiClient): Promise<DeviceState> {
  const { publicKey } = await api.reminders();
  if (!publicKey) return { name: "unavailable" };
  const registration = await currentPushRegistration();
  if (!registration) return { name: "off", publicKey };
  const { mine } = await api.checkReminderDevice(registration.endpoint);
  if (mine) return { name: "on" };
  await registration.unsubscribe();
  return { name: "off", publicKey };
}

function RemindersScreen({ onClose }: { onClose: () => void }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: remindersKey,
    queryFn: () => readDeviceState(api),
  });
  const turnOn = useMutation({
    mutationFn: async (publicKey: string) =>
      api.turnRemindersOn(await registerForPush(publicKey)),
    onSuccess: () => {
      queryClient.setQueryData<DeviceState>(remindersKey, { name: "on" });
    },
  });

  if (query.isError) {
    return (
      <Stack gap="md">
        <Alert color="red" variant="light">
          {errorMessage(query.error)}
        </Alert>
        <Button variant="default" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (!query.data) return <Text c="dimmed">Carregando…</Text>;

  const state = query.data;
  const close = (
    <Button variant="default" onClick={onClose}>
      Fechar
    </Button>
  );
  if (state.name === "unavailable") {
    return (
      <Stack gap="md">
        <Text>Os lembretes não estão disponíveis neste servidor.</Text>
        <DialogActions>{close}</DialogActions>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text>
        Todo dia às 9h, neste dispositivo, você recebe um lembrete das contas
        que vencem no dia e das atrasadas.
      </Text>
      <Group gap="xs">
        <Text fw={500}>Neste dispositivo:</Text>
        <Badge
          variant="light"
          color={state.name === "on" ? "green" : "gray"}
          size="lg"
        >
          {state.name === "on" ? "Ativado" : "Desativado"}
        </Badge>
      </Group>
      {turnOn.error && (
        <Alert color="red" variant="light">
          {errorMessage(turnOn.error)}
        </Alert>
      )}
      <DialogActions>
        {close}
        {state.name === "off" && (
          <Button
            loading={turnOn.isPending}
            onClick={() => turnOn.mutate(state.publicKey)}
          >
            Ativar neste dispositivo
          </Button>
        )}
      </DialogActions>
    </Stack>
  );
}
