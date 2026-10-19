import {
  Alert,
  Box,
  Group,
  Modal,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import type { ColorScheme, OccurrenceView } from "@mensal/shared";
import { useId } from "react";
import { errorMessage } from "./api-error.ts";
import { usePreference, type Preference, type SaveFailure } from "./session.ts";
import { occurrenceViews } from "./occurrence-view.tsx";
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

/** The settings modal, opened from the account menu. */
export function SettingsModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Configurações">
      <SettingsForm />
    </Modal>
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
  const viewLabel = useId();
  // The app's theme (Tema), a preference of the account (PRD §3.5).
  const [colorScheme, setColorScheme, themeFailure] =
    usePreference("colorScheme");
  // How the month lists its occurrences (Visualização), also a preference.
  const [occurrenceView, setOccurrenceView, viewFailure] =
    usePreference("occurrenceView");
  const [showSummary, setShowSummary, summaryFailure] = useShowSummary();
  const [confirmStatusChanges, setConfirmStatusChanges, confirmFailure] =
    useConfirmStatusChanges();
  const failures: Record<Preference, SaveFailure | undefined> = {
    colorScheme: themeFailure,
    occurrenceView: viewFailure,
    showSummary: summaryFailure,
    confirmStatusChanges: confirmFailure,
  };
  // The Alert reports the latest change only: starting one forgets the others.
  const failure = Object.values(failures).find(Boolean);
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
      <Group
        className={classes.row}
        justify="space-between"
        wrap="nowrap"
        gap="lg"
      >
        <Text id={viewLabel} fz="md">
          Visualização
        </Text>
        <SegmentedControl
          aria-labelledby={viewLabel}
          data={occurrenceViews}
          value={occurrenceView}
          onChange={(to) => {
            forgetOtherFailures("occurrenceView");
            setOccurrenceView(to as OccurrenceView);
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
