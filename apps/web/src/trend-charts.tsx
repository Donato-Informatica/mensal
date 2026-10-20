import {
  CompositeChart,
  LineChart,
  type ChartReferenceLineProps,
} from "@mantine/charts";
import {
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useState, type CSSProperties } from "react";
import {
  formatAmount,
  formatAxisPeriod,
  formatCompactAmount,
  formatShortPeriod,
} from "./format.ts";
import classes from "./trend.module.css";
import type { TrendRow } from "./trend-rows.ts";
import { useTrendChartType, type TrendChartType } from "./trend-settings.ts";

type SeriesName = Exclude<keyof TrendRow, "period">;

interface Series {
  name: SeriesName;
  label: string;
  color: string;
  /** Realizado: a dashed line or a solid bar; Previsto the other way round. */
  settled: boolean;
}

// Theme tokens, so both colour schemes resolve them (DESIGN.md). Left over is
// a line, so it takes the highlight: yellow at night, ink on paper (the
// Fill-Only Rule).
const inflow = "var(--mensal-color-inflow)";
const outflow = "var(--mensal-color-rose)";
const leftOver = "var(--mensal-color-highlight)";

const mainSeries: readonly Series[] = [
  {
    name: "inflowExpected",
    label: "Entradas Previsto",
    color: inflow,
    settled: false,
  },
  {
    name: "inflowSettled",
    label: "Entradas Realizado",
    color: inflow,
    settled: true,
  },
  {
    name: "outflowExpected",
    label: "Saídas Previsto",
    color: outflow,
    settled: false,
  },
  {
    name: "outflowSettled",
    label: "Saídas Realizado",
    color: outflow,
    settled: true,
  },
  // Last, so in bar mode its line is drawn over the bars.
  {
    name: "leftOver",
    label: "Sobra prevista",
    color: leftOver,
    settled: false,
  },
];

const accumulatedSeries: readonly Series[] = [
  {
    name: "accumulatedLeftOver",
    label: "Sobra acumulada",
    color: leftOver,
    settled: false,
  },
];

const realizadoDash = "6 4";
const previstoBarOpacity = 0.35;

/**
 * The Evolução charts (PRD §7.11): the main one as lines or bars, and Sobra
 * acumulada always as a line, stacked so a phone never scrolls sideways.
 */
export function TrendCharts({
  rows,
  currentPeriod,
}: {
  rows: readonly TrendRow[];
  currentPeriod: string;
}) {
  const [chartType, setChartType] = useTrendChartType();
  return (
    <Stack gap="lg">
      <SegmentedControl
        aria-label="Tipo de gráfico"
        value={chartType}
        onChange={(value) => setChartType(value as TrendChartType)}
        data={[
          { value: "lines", label: "Linhas" },
          { value: "bars", label: "Barras" },
        ]}
      />
      <TrendChart
        rows={rows}
        currentPeriod={currentPeriod}
        series={mainSeries}
        chartType={chartType}
      />
      <Stack gap="xs">
        <Text fw={600} c="bright">
          Sobra acumulada
        </Text>
        <TrendChart
          rows={rows}
          currentPeriod={currentPeriod}
          series={accumulatedSeries}
          chartType="lines"
        />
      </Stack>
    </Stack>
  );
}

function TrendChart({
  rows,
  currentPeriod,
  series,
  chartType,
}: {
  rows: readonly TrendRow[];
  currentPeriod: string;
  series: readonly Series[];
  chartType: TrendChartType;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<SeriesName>>(new Set());
  const visible = series.filter(({ name }) => !hidden.has(name));
  const toggle = (name: SeriesName) =>
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  const referenceLines: ChartReferenceLineProps[] = [
    { y: 0, ifOverflow: "extendDomain" },
  ];
  if (rows.some(({ period }) => period === currentPeriod)) {
    referenceLines.push({
      x: currentPeriod,
      label: "Hoje",
      color: "dimmed",
      strokeDasharray: "3 3",
      labelPosition: "insideTopLeft",
    });
  }
  const shared = {
    h: 260,
    data: rows as TrendRow[],
    dataKey: "period",
    referenceLines,
    connectNulls: false,
    xAxisProps: { tickFormatter: formatAxisPeriod },
    yAxisProps: { width: 80, tickFormatter: formatCompactAmount },
    tooltipProps: {
      content: ({ label, payload }: TooltipContentProps) => (
        <TrendTooltip label={label} payload={payload} series={visible} />
      ),
    },
  };

  return (
    <Stack gap="sm">
      <TrendLegend
        series={series}
        hidden={hidden}
        chartType={chartType}
        onToggle={toggle}
      />
      {chartType === "bars" ? (
        <CompositeChart
          {...shared}
          maxBarWidth={24}
          series={visible.map(({ name, label, color }) => ({
            name,
            label,
            color,
            type: name === "leftOver" ? "line" : "bar",
          }))}
          barProps={(item) =>
            mainSeries.find(({ name }) => name === item.name)?.settled
              ? {}
              : { fillOpacity: previstoBarOpacity }
          }
        />
      ) : (
        <LineChart
          {...shared}
          series={visible.map(({ name, label, color, settled }) => ({
            name,
            label,
            color,
            ...(settled ? { strokeDasharray: realizadoDash } : {}),
          }))}
        />
      )}
    </Stack>
  );
}

/** Clicking an entry hides or shows its series. */
function TrendLegend({
  series,
  hidden,
  chartType,
  onToggle,
}: {
  series: readonly Series[];
  hidden: ReadonlySet<SeriesName>;
  chartType: TrendChartType;
  onToggle: (name: SeriesName) => void;
}) {
  return (
    <Group gap="xs" wrap="wrap">
      {series.map(({ name, label, color, settled }) => (
        <UnstyledButton
          key={name}
          className={classes.legendItem}
          aria-pressed={!hidden.has(name)}
          onClick={() => onToggle(name)}
        >
          <span
            aria-hidden="true"
            className={classes.swatch}
            data-shape={
              chartType === "bars" && name !== "leftOver" ? "bar" : "line"
            }
            data-settled={settled || undefined}
            style={{ "--swatch-color": color } as CSSProperties}
          />
          {label}
        </UnstyledButton>
      ))}
    </Group>
  );
}

interface TooltipContentProps {
  label?: string | number | undefined;
  payload?: readonly { payload?: TrendRow }[] | undefined;
}

/** Every visible series of the month in full BRL, "—" for a blank Realizado. */
function TrendTooltip({
  label,
  payload,
  series,
}: TooltipContentProps & { series: readonly Series[] }) {
  const row = payload?.[0]?.payload;
  if (!row) return null;
  return (
    <Paper withBorder shadow="md" radius="md" p="sm">
      <Text fw={600} c="bright" mb={4}>
        {formatShortPeriod(String(label ?? row.period))}
      </Text>
      {series.map(({ name, label: seriesLabel }) => {
        const cents = row[name];
        return (
          <Group key={name} justify="space-between" gap="lg" wrap="nowrap">
            <Text size="sm">{seriesLabel}</Text>
            <Text size="sm" className={classes.tooltipAmount}>
              {cents === null ? "—" : formatAmount(cents)}
            </Text>
          </Group>
        );
      })}
    </Paper>
  );
}
