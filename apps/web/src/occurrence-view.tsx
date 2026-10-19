import { Group, SegmentedControl, Stack } from "@mantine/core";
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
 * The bar heading the month's occurrences: the Lista / Tabela switch on the
 * left, `children` (what acts on the occurrences shown) on the right. A view
 * change that could not be saved goes back, and says so.
 */
export function OccurrenceViewBar({ children }: { children?: ReactNode }) {
  const [view, setView, failure] = useOccurrenceView();
  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="sm">
        <SegmentedControl
          aria-label="Visualização"
          size="sm"
          value={view}
          onChange={(to) => {
            const chosen = OccurrenceViewSchema.safeParse(to);
            if (chosen.success) setView(chosen.data);
          }}
          data={occurrenceViews.map(({ value, label }) => ({
            value,
            label: (
              <Group gap={6} wrap="nowrap" justify="center">
                {icons[value]}
                {label}
              </Group>
            ),
          }))}
        />
        {children}
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
