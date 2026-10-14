import {
  ActionIcon,
  Alert,
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
  today,
  type PeriodItem,
  type PeriodPayload,
  type PeriodSummary,
  type StatusChange,
} from "@mensal/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  rootRouteId,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import { errorMessage } from "./api-error.ts";
import { AppLayout } from "./app-layout.tsx";
import { OneOffActions } from "./delete-one-off.tsx";
import { EditOccurrenceButton } from "./edit-occurrence.tsx";
import { formatAmount, formatDayAndMonth, formatPeriod } from "./format.ts";
import { NewOneOffButton } from "./new-one-off.tsx";
import { groupOccurrences, type OccurrenceGroup } from "./occurrence-groups.ts";
import { periodQuery } from "./period-query.ts";
import { RecurrenceActions } from "./recurrence-actions.tsx";
import { useConfirmStatusChanges, useShowSummary } from "./settings.tsx";
import {
  ConfirmStatusChange,
  needsConfirmation,
  SettleCheckbox,
  SkipMenuItem,
  useStatusChange,
  type StatusChangeRequest,
} from "./status-controls.tsx";

/** The monthly screen: one period's summary and occurrences. */
export function Month({ period }: { period: string }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const { data } = useSuspenseQuery(periodQuery(api, period));
  const statusChange = useStatusChange();
  const [showSummary] = useShowSummary();
  const [confirmStatusChanges] = useConfirmStatusChanges();
  const [confirming, setConfirming] = useState<StatusChangeRequest | null>(
    null
  );
  const changeStatus = ({ item, change }: StatusChangeRequest) =>
    statusChange.mutate({ id: item.id, change });

  return (
    <AppLayout>
      <Stack gap="xl">
        <PeriodNavigator period={period}>
          <NewOneOffButton period={period} />
        </PeriodNavigator>
        {showSummary && <Summary summary={data.summary} />}
        {statusChange.error && (
          <Alert
            color="red"
            variant="light"
            withCloseButton
            closeButtonLabel="Fechar"
            onClose={statusChange.reset}
          >
            {errorMessage(statusChange.error)}
          </Alert>
        )}
        <Occurrences
          payload={data}
          onStatusChange={(request) =>
            confirmStatusChanges && needsConfirmation(request.change)
              ? setConfirming(request)
              : changeStatus(request)
          }
        />
      </Stack>
      <ConfirmStatusChange
        request={confirming}
        onConfirm={(request) => {
          setConfirming(null);
          changeStatus(request);
        }}
        onCancel={() => setConfirming(null)}
      />
    </AppLayout>
  );
}

/** `< Outubro 2026 >`: one click, or ← / →, moves a month. */
function PeriodNavigator({
  period,
  children,
}: {
  period: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const move = (months: number) =>
    void navigate({
      to: "/",
      search: { mes: monthOf(shiftPeriod(period, months)) },
    });
  // Inside a dialog, the arrows belong to the dialog (e.g. a month picker).
  const moveUnlessInDialog = (months: number) => (event: KeyboardEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest('[role="dialog"]')
    ) {
      return;
    }
    event.preventDefault();
    move(months);
  };
  useHotkeys([
    ["ArrowLeft", moveUnlessInDialog(-1), { preventDefault: false }],
    ["ArrowRight", moveUnlessInDialog(1), { preventDefault: false }],
  ]);

  // Fixed at the top while the list scrolls (PRD §7.1).
  return (
    <Box pos="sticky" top={0} bg="dark.7" py="xs" style={{ zIndex: 1 }}>
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "var(--mantine-spacing-sm)",
        }}
      >
        <Box />
        <Group justify="space-between" wrap="nowrap" w={400} maw="100%">
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
        <Group justify="flex-end">{children}</Group>
      </Box>
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

function Occurrences({
  payload,
  onStatusChange,
}: {
  payload: PeriodPayload;
  onStatusChange: (request: StatusChangeRequest) => void;
}) {
  const groups = groupOccurrences(payload, today());
  if (groups.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Nenhuma conta neste mês.
      </Text>
    );
  }
  return (
    <Stack component="section" aria-label="Contas do mês" gap="xl">
      {groups.map((group) => (
        <OccurrenceList
          key={group.title}
          group={group}
          period={payload.period}
          onStatusChange={onStatusChange}
        />
      ))}
    </Stack>
  );
}

function OccurrenceList({
  group: { title, items },
  period,
  onStatusChange,
}: {
  group: OccurrenceGroup;
  period: string;
  onStatusChange: (request: StatusChangeRequest) => void;
}) {
  const id = useId();
  return (
    <Stack component="section" aria-labelledby={id} gap="sm">
      <Title
        order={2}
        id={id}
        fz="xs"
        c={title === "Atrasadas" ? "red.5" : "dimmed"}
        tt="uppercase"
        fw={600}
        lts="1.5px"
      >
        {title}
      </Title>
      <Paper bg="dark.6" withBorder radius="lg">
        <Stack
          component="ul"
          aria-label={title}
          gap={0}
          m={0}
          p={0}
          style={{ listStyle: "none" }}
        >
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              period={period}
              first={index === 0}
              onStatusChange={(change) => onStatusChange({ item, change })}
            />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

function Row({
  item,
  period,
  first,
  onStatusChange,
}: {
  item: PeriodItem;
  /** The period on screen; an item of an earlier one is labeled with its own. */
  period: string;
  first: boolean;
  onStatusChange: (change: StatusChange) => void;
}) {
  const status = statusLabel(item, period);
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
      <Group gap="md" wrap="nowrap" miw={0}>
        <SettleCheckbox item={item} onChange={onStatusChange} />
        <EditOccurrenceButton item={item}>
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
        </EditOccurrenceButton>
      </Group>
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
        {item.recurrenceId === null ? (
          <OneOffActions item={item}>
            <SkipMenuItem item={item} onChange={onStatusChange} />
          </OneOffActions>
        ) : (
          <RecurrenceActions
            description={item.description}
            recurrenceId={item.recurrenceId}
          >
            <SkipMenuItem item={item} onChange={onStatusChange} />
          </RecurrenceActions>
        )}
      </Group>
    </Group>
  );
}

// DESIGN.md badge-pill: surface-card; overdue alone stands out in accent-rose.
const quietBadge = { variant: "default" } as const;
const overdueBadge = { variant: "light", color: "red.5" } as const;

// Overdue needs no badge of its own: its group says it.
function statusLabel(item: PeriodItem, period: string) {
  if (item.status === "SETTLED")
    return { label: "Liquidada", badge: quietBadge };
  if (item.status === "SKIPPED") return { label: "Pulada", badge: quietBadge };
  if (item.period !== period)
    return { label: formatPeriod(item.period), badge: overdueBadge };
  return undefined;
}
