import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import {
  monthOf,
  shiftPeriod,
  type PeriodItem,
  type PeriodSummary,
} from "@mensal/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  rootRouteId,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useId } from "react";
import { AppLayout } from "./app-layout.tsx";
import { formatAmount, formatDayAndMonth, formatPeriod } from "./format.ts";
import { periodQuery } from "./period-query.ts";

/** The monthly screen: one period's summary and occurrences. */
export function Month({ period }: { period: string }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const { data } = useSuspenseQuery(periodQuery(api, period));

  return (
    <AppLayout>
      <Stack gap="xl">
        <PeriodNavigator period={period} />
        <Summary summary={data.summary} />
        <Occurrences items={data.items} />
      </Stack>
    </AppLayout>
  );
}

/** `< Outubro 2026 >`: one click, or ← / →, moves a month. */
function PeriodNavigator({ period }: { period: string }) {
  const navigate = useNavigate();
  const move = (months: number) =>
    void navigate({
      to: "/",
      search: { mes: monthOf(shiftPeriod(period, months)) },
    });
  useHotkeys([
    ["ArrowLeft", () => move(-1)],
    ["ArrowRight", () => move(1)],
  ]);

  // Fixed at the top while the list scrolls (PRD §7.1).
  return (
    <Box pos="sticky" top={0} bg="dark.7" py="xs" style={{ zIndex: 1 }}>
      <Group justify="space-between" wrap="nowrap" w="100%" maw={400} mx="auto">
        <ActionIcon
          color="dark.6"
          size={36}
          radius={9999}
          aria-label="Mês anterior"
          onClick={() => move(-1)}
        >
          <Chevron direction="left" />
        </ActionIcon>
        <Title order={1} ta="center">
          {formatPeriod(period)}
        </Title>
        <ActionIcon
          color="dark.6"
          size={36}
          radius={9999}
          aria-label="Próximo mês"
          onClick={() => move(1)}
        >
          <Chevron direction="right" />
        </ActionIcon>
      </Group>
    </Box>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

function Summary({ summary }: { summary: PeriodSummary }) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
      <SummaryBlock
        title="Entradas"
        expected={summary.inflowExpected}
        settled={summary.inflowSettled}
      />
      <SummaryBlock
        title="Saídas"
        expected={summary.outflowExpected}
        settled={summary.outflowSettled}
      />
    </SimpleGrid>
  );
}

function SummaryBlock({
  title,
  expected,
  settled,
}: {
  title: string;
  expected: number;
  settled: number;
}) {
  const id = useId();
  return (
    <Paper
      component="section"
      aria-labelledby={`${id}-title`}
      bg="dark.6"
      withBorder
      p="lg"
      radius="lg"
    >
      <Title order={2} id={`${id}-title`} fz="md" fw={600}>
        {title}
      </Title>
      <Group mt="sm" gap="xl" align="flex-end">
        <Figure label="Previsto" cents={expected} />
        <Figure label="Realizado" cents={settled} />
      </Group>
    </Paper>
  );
}

function Figure({ label, cents }: { label: string; cents: number }) {
  const id = useId();
  return (
    <Stack gap={2}>
      <Text id={id} fz="xs" c="dimmed" tt="uppercase" fw={600} lts="1.5px">
        {label}
      </Text>
      <Text aria-labelledby={id} fz="xl" fw={700} c="white">
        {formatAmount(cents)}
      </Text>
    </Stack>
  );
}

function Occurrences({ items }: { items: PeriodItem[] }) {
  if (items.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Nenhuma conta neste mês.
      </Text>
    );
  }
  return (
    <Paper bg="dark.6" withBorder radius="lg">
      <Stack
        component="ul"
        aria-label="Contas do mês"
        gap={0}
        m={0}
        p={0}
        style={{ listStyle: "none" }}
      >
        {items.map((item, index) => (
          <Row key={item.id} item={item} first={index === 0} />
        ))}
      </Stack>
    </Paper>
  );
}

function Row({ item, first }: { item: PeriodItem; first: boolean }) {
  const status = statusLabel(item);
  return (
    <Group
      component="li"
      justify="space-between"
      wrap="nowrap"
      px="lg"
      py="sm"
      style={
        first
          ? undefined
          : { borderTop: "1px solid var(--mantine-color-dark-5)" }
      }
    >
      <Stack gap={0} miw={0}>
        <Text c="white" fw={500} truncate>
          {item.description}
        </Text>
        <Text fz="sm" c="dimmed">
          {item.dueDate === null
            ? "Sem vencimento"
            : formatDayAndMonth(item.dueDate)}
        </Text>
      </Stack>
      <Group gap="sm" wrap="nowrap">
        <Text
          fw={600}
          c={
            item.amount === null
              ? "dimmed"
              : item.direction === "INFLOW"
                ? "green.5"
                : "white"
          }
          style={{ whiteSpace: "nowrap" }}
        >
          {item.amount === null ? "A definir" : formatAmount(item.amount)}
        </Text>
        {status && <Badge {...status.badge}>{status.label}</Badge>}
      </Group>
    </Group>
  );
}

// DESIGN.md badge-pill: surface-card; overdue alone stands out in accent-rose.
const quietBadge = { variant: "default" } as const;
const overdueBadge = { variant: "light", color: "red.5" } as const;

function statusLabel(item: PeriodItem) {
  if (item.status === "SETTLED")
    return { label: "Liquidada", badge: quietBadge };
  if (item.status === "SKIPPED") return { label: "Pulada", badge: quietBadge };
  if (item.overdue) return { label: "Atrasada", badge: overdueBadge };
  return undefined;
}
