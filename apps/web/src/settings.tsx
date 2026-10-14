import { Button, Modal, Stack, Switch } from "@mantine/core";
import { useDisclosure, useLocalStorage } from "@mantine/hooks";

/** Per-device display preferences, kept in the browser. */
export function useShowSummary() {
  return useLocalStorage({
    key: "mensal:show-summary",
    defaultValue: true,
    getInitialValueInEffect: false,
  });
}

/** Whether settling, skipping or taking back to pending is confirmed first. */
export function useConfirmStatusChanges() {
  return useLocalStorage({
    key: "mensal:confirm-status-changes",
    defaultValue: true,
    getInitialValueInEffect: false,
  });
}

/** Header button that opens the settings modal. */
export function SettingsButton() {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button
        variant="subtle"
        color="gray"
        size="sm"
        h={{ base: 44, sm: 30 }}
        onClick={open}
      >
        Configurações
      </Button>
      <Modal opened={opened} onClose={close} title="Configurações" centered>
        <SettingsForm />
      </Modal>
    </>
  );
}

function SettingsForm() {
  const [showSummary, setShowSummary] = useShowSummary();
  const [confirmStatusChanges, setConfirmStatusChanges] =
    useConfirmStatusChanges();
  return (
    <Stack gap="md">
      <Switch
        label="Mostrar resumo de entradas e saídas"
        checked={showSummary}
        onChange={(event) => setShowSummary(event.currentTarget.checked)}
      />
      <Switch
        label="Confirmar antes de liquidar, pular ou voltar uma conta para pendente"
        checked={confirmStatusChanges}
        onChange={(event) =>
          setConfirmStatusChanges(event.currentTarget.checked)
        }
      />
    </Stack>
  );
}
