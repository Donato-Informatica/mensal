import { Group, SegmentedControl, Stack, VisuallyHidden } from "@mantine/core";
import { OccurrenceViewSchema, type OccurrenceView } from "@mensal/shared";
import { IconLayoutList, IconTable } from "@tabler/icons-react";
import type { ReactNode } from "react";
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

const icons: Record<OccurrenceView, ReactNode> = {
  list: <IconLayoutList size={18} aria-hidden="true" />,
  table: <IconTable size={18} aria-hidden="true" />,
};

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
          onChange={(to) => {
            const chosen = OccurrenceViewSchema.safeParse(to);
            if (chosen.success) setView(chosen.data);
          }}
          data={occurrenceViews.map(({ value, label }) => ({
            value,
            label: (
              <>
                {icons[value]}
                <VisuallyHidden>{label}</VisuallyHidden>
              </>
            ),
          }))}
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
