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
  formatAxisPeriod,
  formatCompactAmount,
  formatOptionalAmount,
  formatShortPeriod,
} from "./format.ts";
import classes from "./trend.module.css";
import { trendLabels, type TrendRow, type TrendValue } from "./trend-rows.ts";
import { useTrendSetting, type TrendChartType } from "./trend-settings.ts";

interface Series {
  name: TrendValue;
  label: string;
  color: string;
  /** Realizado: a dashed line or a solid bar; Previsto the other way round. */
  settled: boolean;
  /** A line even when the chart draws bars, e.g. Sobra prevista. */
  alwaysLine?: boolean;
}

/** The series of `name`, labelled as everywhere else in the trend. */
function seriesOf(
  name: TrendValue,
  color: string,
  options: Pick<Series, "settled" | "alwaysLine">
): Series {
  return { name, label: trendLabels[name], color, ...options };
}

// Theme tokens, so both colour schemes resolve them (DESIGN.md). Left over is
// a line, so it takes the highlight: yellow at night, ink on paper (the
// Fill-Only Rule).
const inflow = "var(--mensal-color-inflow)";
const outflow = "var(--mensal-color-rose)";
const leftOver = "var(--mensal-color-highlight)";

const mainSeries: readonly Series[] = [
  seriesOf("inflowExpected", inflow, { settled: false }),
  seriesOf("inflowSettled", inflow, { settled: true }),
  seriesOf("outflowExpected", outflow, { settled: false }),
  seriesOf("outflowSettled", outflow, { settled: true }),
  // Last, so in bar mode its line is drawn over the bars.
  seriesOf("leftOver", leftOver, { settled: false, alwaysLine: true }),
];

const accumulatedSeries: readonly Series[] = [
  seriesOf("accumulatedLeftOver", leftOver, {
    settled: false,
    alwaysLine: true,
  }),
];

/**
 * How `series` is drawn in a `chartType` chart, and so in its legend:
 * Realizado a dashed line or a solid bar, Previsto a solid line or a
 * translucent bar.
 */
function seriesStyle(
  { settled, alwaysLine }: Series,
  chartType: TrendChartType
): { type: "line" | "bar"; strokeDasharray?: string; opacity?: number } {
  if (chartType === "bars" && !alwaysLine) {
    return { type: "bar", ...(settled ? {} : { opacity: 0.35 }) };
  }
  return { type: "line", ...(settled ? { strokeDasharray: "6 4" } : {}) };
}

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
  const [chartType, setChartType] = useTrendSetting("chartType");
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
  const [hidden, setHidden] = useState<ReadonlySet<TrendValue>>(new Set());
  const visible = series.filter(({ name }) => !hidden.has(name));
  const toggle = (name: TrendValue) =>
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
      color: "dimmed",
      strokeDasharray: "3 3",
    });
  }
  const commonChartProps = {
    h: 260,
    data: [...rows],
    dataKey: "period",
    referenceLines,
    connectNulls: false,
    xAxisProps: { tickFormatter: formatAxisPeriod },
    yAxisProps: { width: 80, tickFormatter: formatCompactAmount },
    tooltipProps: {
      content: ({ label, payload }: TooltipContentProps) => (
        // Every series, even one hidden through the legend (PRD §7.11).
        <TrendTooltip label={label} payload={payload} series={series} />
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
          {...commonChartProps}
          maxBarWidth={24}
          series={visible.map((each) => ({
            name: each.name,
            label: each.label,
            color: each.color,
            type: seriesStyle(each, chartType).type,
          }))}
          barProps={(item) => {
            const each = series.find(({ name }) => name === item.name);
            const opacity = each && seriesStyle(each, chartType).opacity;
            return opacity === undefined ? {} : { fillOpacity: opacity };
          }}
        />
      ) : (
        <LineChart
          {...commonChartProps}
          series={visible.map((each) => {
            const { strokeDasharray } = seriesStyle(each, chartType);
            return {
              name: each.name,
              label: each.label,
              color: each.color,
              ...(strokeDasharray ? { strokeDasharray } : {}),
            };
          })}
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
  hidden: ReadonlySet<TrendValue>;
  chartType: TrendChartType;
  onToggle: (name: TrendValue) => void;
}) {
  return (
    <Group gap="xs" wrap="wrap">
      {series.map((each) => {
        const { name, label, color, settled } = each;
        const { type, opacity } = seriesStyle(each, chartType);
        return (
          <UnstyledButton
            key={name}
            className={classes.legendItem}
            aria-pressed={!hidden.has(name)}
            onClick={() => onToggle(name)}
          >
            <span
              aria-hidden="true"
              className={classes.swatch}
              data-shape={type}
              data-settled={settled || undefined}
              style={
                {
                  "--swatch-color": color,
                  opacity,
                } as CSSProperties
              }
            />
            {label}
          </UnstyledButton>
        );
      })}
    </Group>
  );
}

interface TooltipContentProps {
  label?: string | number | undefined;
  payload?: readonly { payload?: TrendRow }[] | undefined;
}

/** Every series of the month in full BRL, "—" for a blank Realizado. */
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
      {series.map(({ name, label: seriesLabel }) => (
        <Group key={name} justify="space-between" gap="lg" wrap="nowrap">
          <Text size="sm">{seriesLabel}</Text>
          <Text size="sm" className={classes.tooltipAmount}>
            {formatOptionalAmount(row[name])}
          </Text>
        </Group>
      ))}
    </Paper>
  );
}
