import { Alert, Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import type { ApiClient } from "./api-client.ts";
import { errorMessage } from "./api-error.ts";
import {
  currentPushRegistration,
  needsInstallForPush,
  pushBlocked,
  pushSupported,
  registerForPush,
} from "./browser-push.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { GuideLink } from "./guide-link.tsx";

const remindersKey = ["reminders"];

/**
 * Reminders as this screen shows them (PRD §7.19): not configured on this
 * server at all, or this device's state and how many of the user's other
 * devices have reminders on.
 */
type RemindersState =
  | { name: "server-off" }
  | { name: "device"; device: DeviceState; otherDevices: number };

/** This device: on, off, blocked by the browser, or without the Push API. */
type DeviceState =
  | { name: "on" }
  | { name: "off"; publicKey: string }
  | { name: "blocked" }
  | { name: "unsupported"; needsInstall: boolean };

/**
 * The "Lembretes" modal, opened from the account menu (PRD §7.19): turns
 * reminders (§6.8) on or off for the device the user is on, or off on every
 * device.
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
 * The state, read whenever the screen opens. Whether this device is on comes
 * from the server (`POST /device/check`), never from the browser's
 * registration alone; one the server says is not the user's is dropped
 * (PRD §8.2).
 */
async function readRemindersState(api: ApiClient): Promise<RemindersState> {
  const { publicKey, deviceCount } = await api.reminders();
  if (!publicKey) return { name: "server-off" };
  if (!pushSupported()) {
    return {
      name: "device",
      device: { name: "unsupported", needsInstall: needsInstallForPush() },
      otherDevices: deviceCount,
    };
  }
  const registration = await currentPushRegistration();
  let mine = false;
  if (registration) {
    ({ mine } = await api.checkReminderDevice(registration.endpoint));
    if (!mine) await registration.unsubscribe();
  }
  const otherDevices = deviceCount - (mine ? 1 : 0);
  if (pushBlocked()) {
    return { name: "device", device: { name: "blocked" }, otherDevices };
  }
  return {
    name: "device",
    device: mine ? { name: "on" } : { name: "off", publicKey },
    otherDevices,
  };
}

function RemindersScreen({ onClose }: { onClose: () => void }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const query = useQuery({
    queryKey: remindersKey,
    queryFn: () => readRemindersState(api),
  });
  const reread = () =>
    queryClient.invalidateQueries({ queryKey: remindersKey });
  const turnOn = useMutation({
    mutationFn: async (publicKey: string) => {
      const device = await registerForPush(publicKey);
      // Not granted: the state is read again, Bloqueado when it was denied.
      if (device) await api.turnRemindersOn(device);
    },
    onSuccess: reread,
  });
  const turnOff = useMutation({
    mutationFn: async () => {
      const registration = await currentPushRegistration();
      if (!registration) return;
      await api.turnReminderDeviceOff(registration.endpoint);
      await registration.unsubscribe();
    },
    onSuccess: reread,
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
  if (state.name === "server-off") {
    return (
      <Stack gap="md">
        <Text>Os lembretes não estão disponíveis neste servidor.</Text>
        <DialogActions>{close}</DialogActions>
      </Stack>
    );
  }
  if (confirming) {
    return (
      <ConfirmTurnOffEverywhere
        onCancel={() => setConfirming(false)}
        onDone={() => setConfirming(false)}
      />
    );
  }

  const { device, otherDevices } = state;
  const error = turnOn.error ?? turnOff.error;
  return (
    <Stack gap="md">
      <Stack gap={4} align="flex-start">
        <Text>
          Todo dia às 9h, neste dispositivo, você recebe um lembrete das contas
          que vencem no dia e das atrasadas.
        </Text>
        <GuideLink section="lembretes">Como funcionam os lembretes</GuideLink>
      </Stack>
      <Group gap="xs">
        <Text fw={500}>Neste dispositivo:</Text>
        <DeviceBadge device={device} />
      </Group>
      <DeviceExplanation device={device} />
      {error && (
        <Alert color="red" variant="light">
          {errorMessage(error)}
        </Alert>
      )}
      <DialogActions>
        {close}
        {device.name === "off" && (
          <Button
            loading={turnOn.isPending}
            onClick={() => turnOn.mutate(device.publicKey)}
          >
            Ativar neste dispositivo
          </Button>
        )}
        {device.name === "on" && (
          <Button
            variant="light"
            color="red"
            loading={turnOff.isPending}
            onClick={() => turnOff.mutate()}
          >
            Desativar neste dispositivo
          </Button>
        )}
      </DialogActions>
      {otherDevices > 0 && (
        <Stack gap="xs">
          <Text>
            Ativado em mais {otherDevices}{" "}
            {otherDevices === 1 ? "dispositivo" : "dispositivos"}
          </Text>
          <Button
            variant="light"
            color="red"
            onClick={() => setConfirming(true)}
          >
            Desativar em todos os dispositivos
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function DeviceBadge({ device }: { device: DeviceState }) {
  const badges: Record<DeviceState["name"], [label: string, color: string]> = {
    on: ["Ativado", "green"],
    off: ["Desativado", "gray"],
    blocked: ["Bloqueado pelo navegador", "red"],
    unsupported: ["Indisponível", "gray"],
  };
  const [label, color] = badges[device.name];
  return (
    <Badge variant="light" color={color} size="lg">
      {label}
    </Badge>
  );
}

/** Why the browser stands in the way, when it does, and what to do. */
function DeviceExplanation({ device }: { device: DeviceState }) {
  if (device.name === "blocked") {
    return (
      <Text size="sm" c="dimmed">
        Este navegador bloqueou as notificações do Mensal. Para receber
        lembretes, permita as notificações nas configurações do site (no ícone
        ao lado do endereço) e abra esta tela de novo.
      </Text>
    );
  }
  if (device.name === "unsupported") {
    if (device.needsInstall) {
      return (
        <Stack gap={4} align="flex-start">
          <Text size="sm">
            Instale o app na tela inicial para receber lembretes.
          </Text>
          <GuideLink section="instalar">Como instalar o app</GuideLink>
        </Stack>
      );
    }
    return (
      <Text size="sm" c="dimmed">
        Este navegador não recebe lembretes.
      </Text>
    );
  }
  return null;
}

function ConfirmTurnOffEverywhere({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const turnOffEverywhere = useMutation({
    mutationFn: async () => {
      await api.turnRemindersOffEverywhere();
      // This browser's registration is no longer anyone's: drop it too.
      if (pushSupported())
        await (await currentPushRegistration())?.unsubscribe();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: remindersKey });
      onDone();
    },
  });

  return (
    <Stack gap="md">
      {turnOffEverywhere.error && (
        <Alert color="red" variant="light">
          {errorMessage(turnOffEverywhere.error)}
        </Alert>
      )}
      <Text>
        Os lembretes serão desativados em todos os dispositivos, inclusive
        neste. Você pode ativá-los de novo em cada um quando quiser.
      </Text>
      <DialogActions>
        <Button variant="default" onClick={onCancel} data-autofocus>
          Cancelar
        </Button>
        <Button
          color="red"
          loading={turnOffEverywhere.isPending}
          onClick={() => turnOffEverywhere.mutate()}
        >
          Desativar em todos
        </Button>
      </DialogActions>
    </Stack>
  );
}
