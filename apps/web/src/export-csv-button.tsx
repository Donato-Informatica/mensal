import { Button, Text } from "@mantine/core";
import { today, type PeriodPayload } from "@mensal/shared";
import { IconDownload } from "@tabler/icons-react";
import { occurrenceCsv, periodCsvRows } from "./occurrence-csv.ts";

/**
 * Downloads the period on screen as `mensal-AAAA-MM.csv` (PRD §7.9). It is
 * built in the browser from the loaded payload, so it never materializes a
 * virtual occurrence.
 */
export function ExportCsvButton({ payload }: { payload: PeriodPayload }) {
  const now = today();
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([occurrenceCsv(payload, now)], {
        type: "text/csv;charset=utf-8",
      })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `mensal-${payload.period.slice(0, 7)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <Button
      variant="subtle"
      color="gray"
      size="sm"
      h={{ base: 44, sm: 30 }}
      px="xs"
      aria-label="Exportar CSV"
      disabled={periodCsvRows(payload, now).length === 0}
      leftSection={<IconDownload size={18} aria-hidden="true" />}
      styles={{ section: { marginInlineEnd: 0 } }}
      onClick={download}
    >
      <Text span visibleFrom="sm" ml={8}>
        Exportar CSV
      </Text>
    </Button>
  );
}
