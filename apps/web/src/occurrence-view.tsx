import { Group, SegmentedControl, Stack, VisuallyHidden } from "@mantine/core";
import type { OccurrenceView } from "@mensal/shared";
import { IconLayoutList, IconTable } from "@tabler/icons-react";
import { FailureNotice } from "./occurrence-row-parts.tsx";
import { usePreference } from "./session.ts";

/**
 * How the monthly screen shows its occurrences: a preference of the account,
 * shared by every device the user signs in on (PRD §3.5).
 */
export function useOccurrenceView() {
  return usePreference("occurrenceView");
}

/** The options as Configurações words them. */
export const occurrenceViews: { value: OccurrenceView; label: string }[] = [
  { value: "list", label: "Lista" },
  { value: "table", label: "Tabela" },
];

/**
 * The compact Lista / Tabela switch next to the period navigator. A change
 * that could not be saved goes back, and says so.
 */
export function OccurrenceViewSwitch() {
  const [view, setView, failure] = useOccurrenceView();
  return (
    <Stack gap="xs">
      <Group justify="flex-end">
        <SegmentedControl
          aria-label="Visualização"
          size="xs"
          value={view}
          onChange={(to) => setView(to as OccurrenceView)}
          data={[
            {
              value: "list",
              label: (
                <>
                  <IconLayoutList size={18} aria-hidden="true" />
                  <VisuallyHidden>Lista</VisuallyHidden>
                </>
              ),
            },
            {
              value: "table",
              label: (
                <>
                  <IconTable size={18} aria-hidden="true" />
                  <VisuallyHidden>Tabela</VisuallyHidden>
                </>
              ),
            },
          ]}
        />
      </Group>
      {failure && (
        <FailureNotice
          error={failure.error}
          onRetry={() => setView(view === "list" ? "table" : "list")}
          onDismiss={failure.dismiss}
        />
      )}
    </Stack>
  );
}
