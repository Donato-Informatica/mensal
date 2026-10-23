import { Button } from "@mantine/core";
import { today, type PeriodPayload } from "@mensal/shared";
import { IconDownload } from "@tabler/icons-react";
import { useMemo } from "react";
import { occurrenceCsv, periodCsvRows } from "./occurrence-csv.ts";
import { saveFile } from "./save-file.ts";

/**
 * Downloads the period on screen as `mensal-AAAA-MM.csv` (PRD §7.9). It is
 * built in the browser from the loaded payload, so it never materializes a
 * virtual occurrence.
 */
export function ExportCsvButton({ payload }: { payload: PeriodPayload }) {
  const empty = useMemo(
    () => periodCsvRows(payload, today()).length === 0,
    [payload]
  );
  const download = () =>
    saveFile(
      new Blob([occurrenceCsv(payload, today())], {
        type: "text/csv;charset=utf-8",
      }),
      `mensal-${payload.period.slice(0, 7)}.csv`
    );
  return (
    <Button
      variant="subtle"
      color="gray"
      size="sm"
      h={36}
      px="xs"
      disabled={empty}
      leftSection={<IconDownload size={18} aria-hidden="true" />}
      onClick={download}
    >
      Exportar CSV
    </Button>
  );
}
