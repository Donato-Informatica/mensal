import {
  Alert,
  Box,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ColorScheme } from "@mensal/shared";
import { IconSettings } from "@tabler/icons-react";
import { useId } from "react";
import { errorMessage } from "./api-error.ts";
import headerButton from "./header-button.module.css";
import { usePreference, type Preference } from "./session.ts";
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

/** The app's theme (Tema): a preference of the account (PRD §3.5). */
function useColorSchemePreference() {
  return usePreference("colorScheme");
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

const colorSchemes: { value: ColorScheme; label: string }[] = [
  { value: "dark", label: "Escuro" },
  { value: "light", label: "Claro" },
  { value: "auto", label: "Automático" },
];

function SettingsForm() {
  const themeLabel = useId();
  const [colorScheme, setColorScheme, themeFailure] =
    useColorSchemePreference();
  const [showSummary, setShowSummary, summaryFailure] = useShowSummary();
  const [confirmStatusChanges, setConfirmStatusChanges, confirmFailure] =
    useConfirmStatusChanges();
  const failures: Record<Preference, typeof themeFailure> = {
    colorScheme: themeFailure,
    showSummary: summaryFailure,
    confirmStatusChanges: confirmFailure,
  };
  // The Alert reports the latest change only: starting one forgets the others.
  const failure = themeFailure ?? summaryFailure ?? confirmFailure;
  function forgetOtherFailures(changing: Preference) {
    for (const [preference, other] of Object.entries(failures)) {
      if (preference !== changing) other?.dismiss();
    }
  }
  return (
    <Box>
      {failure && (
        <Alert color="red" variant="light" mb="md">
          <Text span fw={600}>
            Alteração não salva.
          </Text>{" "}
          {errorMessage(failure.error)}
        </Alert>
      )}
      <Group
        className={classes.row}
        justify="space-between"
        wrap="nowrap"
        gap="lg"
      >
        <Text id={themeLabel} fz="md">
          Tema
        </Text>
        <SegmentedControl
          aria-labelledby={themeLabel}
          data={colorSchemes}
          value={colorScheme}
          onChange={(to) => {
            forgetOtherFailures("colorScheme");
            setColorScheme(to);
          }}
        />
      </Group>
      <Switch
        {...switchProps}
        label="Mostrar resumo de entradas e saídas"
        checked={showSummary}
        onChange={(event) => {
          forgetOtherFailures("showSummary");
          setShowSummary(event.currentTarget.checked);
        }}
      />
      <Switch
        {...switchProps}
        label="Confirmar antes de liquidar, pular ou voltar uma conta para pendente"
        checked={confirmStatusChanges}
        onChange={(event) => {
          forgetOtherFailures("confirmStatusChanges");
          setConfirmStatusChanges(event.currentTarget.checked);
        }}
      />
    </Box>
  );
}
