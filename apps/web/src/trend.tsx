import {
  ActionIcon,
  Button,
  Collapse,
  Modal,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { currentPeriod, shiftPeriod } from "@mensal/shared";
import { IconChartLine, IconChevronDown } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useId } from "react";
import { formatAmount, formatShortPeriod } from "./format.ts";
import { summariesQuery } from "./summaries-query.ts";
import classes from "./trend.module.css";
import { isEmptyTrend, trendRows, type TrendRow } from "./trend-rows.ts";
import {
  trendRanges,
  useTrendRange,
  type TrendRange,
} from "./trend-settings.ts";

/** The summary bar's "Evolução" button. */
export function TrendButton({ onClick }: { onClick: () => void }) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size={28}
      aria-label="Evolução"
      title="Evolução"
      onClick={onClick}
    >
      <IconChartLine size={18} aria-hidden="true" />
    </ActionIcon>
  );
}

/**
 * The Evolução modal (PRD §7.11): the 3, 6 or 12 periods ending at `period`,
 * inclusive, even a future one. Full screen on phones.
 */
export function TrendModal({
  period,
  opened,
  onClose,
}: {
  /** The period on screen ('YYYY-MM-01'), the last of the range. */
  period: string;
  opened: boolean;
  onClose: () => void;
}) {
  const theme = useMantineTheme();
  const phone = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [range] = useTrendRange();
  const from = shiftPeriod(period, 1 - range);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen={phone}
      size="xl"
      title={`${formatShortPeriod(from)} – ${formatShortPeriod(period)}`}
    >
      <TrendContent from={from} to={period} />
    </Modal>
  );
}

function TrendContent({ from, to }: { from: string; to: string }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const [range, setRange] = useTrendRange();
  const query = useQuery(summariesQuery(api, from, to));
  return (
    <Stack gap="lg">
      <SegmentedControl
        aria-label="Meses da evolução"
        value={String(range)}
        onChange={(value) => setRange(Number(value) as TrendRange)}
        data={trendRanges.map((months) => ({
          value: String(months),
          label: `${months} meses`,
        }))}
      />
      {query.isPending ? (
        <Stack gap="sm" aria-busy="true" aria-label="Carregando a evolução">
          <Skeleton height={240} radius="lg" />
          <Skeleton height={36} radius="lg" />
        </Stack>
      ) : query.isError ? (
        <Stack align="center" gap="sm" py="xl" ta="center">
          <Text c="dimmed">Não foi possível carregar a evolução.</Text>
          <Button
            variant="default"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </Stack>
      ) : isEmptyTrend(query.data.items) ? (
        <Text c="dimmed" ta="center" py="xl">
          Nenhuma conta nesses meses.
        </Text>
      ) : (
        <TrendValues rows={trendRows(query.data.items, currentPeriod())} />
      )}
    </Stack>
  );
}

/** "Ver valores": the trend's numbers as a table, for reading without a chart. */
function TrendValues({ rows }: { rows: readonly TrendRow[] }) {
  const [opened, { toggle }] = useDisclosure(false);
  const id = useId();
  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        color="gray"
        aria-expanded={opened}
        aria-controls={id}
        rightSection={
          <IconChevronDown
            size={18}
            aria-hidden="true"
            className={classes.chevron}
            data-opened={opened || undefined}
          />
        }
        onClick={toggle}
        style={{ alignSelf: "flex-start" }}
      >
        Ver valores
      </Button>
      <Collapse expanded={opened} id={id}>
        <TrendTable rows={rows} />
      </Collapse>
    </Stack>
  );
}

const trendColumns = [
  "Competência",
  "Entradas Previsto",
  "Entradas Realizado",
  "Saídas Previsto",
  "Saídas Realizado",
  "Sobra prevista",
  "Sobra acumulada",
];

function TrendTable({ rows }: { rows: readonly TrendRow[] }) {
  const settled = (cents: number | null) =>
    cents === null ? "—" : formatAmount(cents);
  return (
    <div className={classes.scroll} tabIndex={0}>
      <Table className={classes.table}>
        <Table.Thead>
          <Table.Tr>
            {trendColumns.map((column, index) => (
              <Table.Th
                key={column}
                className={index === 0 ? undefined : classes.amount}
              >
                {column}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.period}>
              <Table.Th scope="row" className={classes.period}>
                {formatShortPeriod(row.period)}
              </Table.Th>
              <Table.Td className={classes.amount}>
                {formatAmount(row.inflowExpected)}
              </Table.Td>
              <Table.Td className={classes.amount}>
                {settled(row.inflowSettled)}
              </Table.Td>
              <Table.Td className={classes.amount}>
                {formatAmount(row.outflowExpected)}
              </Table.Td>
              <Table.Td className={classes.amount}>
                {settled(row.outflowSettled)}
              </Table.Td>
              <Table.Td className={classes.amount}>
                {formatAmount(row.leftOver)}
              </Table.Td>
              <Table.Td className={classes.amount}>
                {formatAmount(row.accumulatedLeftOver)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
