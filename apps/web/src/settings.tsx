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

/** Header button that opens the settings modal. */
export function SettingsButton() {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button variant="subtle" color="gray" size="sm" onClick={open}>
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
  return (
    <Stack gap="md">
      <Switch
        label="Mostrar resumo de entradas e saídas"
        checked={showSummary}
        onChange={(event) => setShowSummary(event.currentTarget.checked)}
      />
    </Stack>
  );
}
