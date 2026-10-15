import { Box, Button, Modal, Switch } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import headerButton from "./header-button.module.css";
import { usePreference } from "./session.ts";
import classes from "./settings.module.css";

/**
 * Whether the month shows its summary of inflows and outflows: a preference
 * of the account, shared by every device the user signs in on (PRD §3.5).
 */
export function useShowSummary() {
  return usePreference("showSummary");
}

/**
 * Whether settling, skipping or taking back to pending is confirmed first: a
 * preference of the account (PRD §3.5).
 */
export function useConfirmStatusChanges() {
  return usePreference("confirmStatusChanges");
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
        leftSection={<IconSettings size={18} aria-hidden="true" />}
        classNames={{ section: headerButton.section }}
        aria-label="Configurações"
        title="Configurações"
        onClick={open}
      >
        <Box component="span" visibleFrom="sm">
          Configurações
        </Box>
      </Button>
      <Modal opened={opened} onClose={close} title="Configurações">
        <SettingsForm />
      </Modal>
    </>
  );
}

const switchProps = {
  labelPosition: "left",
  size: "md",
  classNames: {
    root: classes.row,
    body: classes.body,
    labelWrapper: classes.labelWrapper,
    label: classes.label,
  },
} as const;

function SettingsForm() {
  const [showSummary, setShowSummary] = useShowSummary();
  const [confirmStatusChanges, setConfirmStatusChanges] =
    useConfirmStatusChanges();
  return (
    <Box>
      <Switch
        {...switchProps}
        label="Mostrar resumo de entradas e saídas"
        checked={showSummary}
        onChange={(event) => setShowSummary(event.currentTarget.checked)}
      />
      <Switch
        {...switchProps}
        label="Confirmar antes de liquidar, pular ou voltar uma conta para pendente"
        checked={confirmStatusChanges}
        onChange={(event) =>
          setConfirmStatusChanges(event.currentTarget.checked)
        }
      />
    </Box>
  );
}
