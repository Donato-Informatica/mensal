import {
  ActionIcon,
  Badge,
  Box,
  Button,
  CloseButton,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import {
  currentPeriod,
  monthOf,
  periodOfMonth,
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
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useId, useState } from "react";
import { errorMessage } from "./api-error.ts";
import { AppLayout } from "./app-layout.tsx";
import appLayout from "./app-layout.module.css";
import { OneOffActions } from "./delete-one-off.tsx";
import { EditOccurrenceButton } from "./edit-occurrence.tsx";
import { useFlip } from "./flip.ts";
import { formatAmount, formatDayAndMonth, formatPeriod } from "./format.ts";
import classes from "./occurrence-row.module.css";
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
import { UndoToast } from "./undo-toast.tsx";

/** A change the API refused, kept until retried or dismissed. */
type Failure = { request: StatusChangeRequest; error: unknown };

/** The monthly screen: one period's summary and occurrences. */
export function Month({ period }: { period: string }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const { data } = useSuspenseQuery(periodQuery(api, period));
  // Another month is on its way: this one stays up, dimmed, until it lands.
  const loading = useRouterState({ select: (state) => state.isLoading });
  const [showSummary, setShowSummary] = useShowSummary();
  const [confirmStatusChanges] = useConfirmStatusChanges();
  const [confirming, setConfirming] = useState<StatusChangeRequest | null>(
    null
  );
  const [undoable, setUndoable] = useState<StatusChangeRequest | null>(null);
  const [failures, setFailures] = useState<ReadonlyMap<string, Failure>>(
    new Map()
  );
  const withoutFailure = (id: string) => {
    setFailures((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };
  const statusChange = useStatusChange({
    onFailure: (request, error) => {
      setUndoable((current) =>
        current?.item.id === request.item.id ? null : current
      );
      setFailures((current) =>
        new Map(current).set(request.item.id, { request, error })
      );
    },
  });
  const changeStatus = (request: StatusChangeRequest) => {
    withoutFailure(request.item.id);
    setUndoable(request);
    statusChange.mutate(request);
  };
  const dismissUndo = useCallback(() => setUndoable(null), []);

  return (
    <AppLayout action={<NewOneOffButton period={period} />}>
      <Stack gap="xl">
        <PeriodNavigator />
        <Stack gap="xl" className={classes.content} aria-busy={loading}>
          {showSummary && (
            <Summary
              summary={data.summary}
              onClose={() => setShowSummary(false)}
              excluded={data.items.some(
                (item) => item.amount === null || item.status === "SKIPPED"
              )}
            />
          )}
          <Occurrences
            payload={data}
            failures={failures}
            onDismissFailure={withoutFailure}
            onRetry={changeStatus}
            onStatusChange={(request) =>
              confirmStatusChanges && needsConfirmation(request.change)
                ? setConfirming(request)
                : changeStatus(request)
            }
          />
        </Stack>
      </Stack>
      <ConfirmStatusChange
        request={confirming}
        onConfirm={(request) => {
          setConfirming(null);
          changeStatus(request);
        }}
        onCancel={() => setConfirming(null)}
      />
      <UndoToast
        request={undoable}
        onDismiss={dismissUndo}
        onUndo={(request, back) => {
          setUndoable(null);
          withoutFailure(request.item.id);
          statusChange.mutate({ item: request.item, change: back });
        }}
      />
      <VisuallyHidden role="status">
        {loading ? "Carregando o mês…" : ""}
      </VisuallyHidden>
    </AppLayout>
  );
}

/** `< Outubro 2026 >`: one click, or ← / →, moves a month. */
function PeriodNavigator() {
  const navigate = useNavigate();
  // The month asked for, which runs ahead of the one on screen while it loads:
  // the title answers a click at once and fast repeats keep stepping.
  const asked = useRouterState({
    select: (state) => state.location.search as { mes?: unknown },
  });
  const target =
    (typeof asked.mes === "string" ? periodOfMonth(asked.mes) : undefined) ??
    currentPeriod();
  const move = (months: number) =>
    void navigate({
      to: "/",
      search: { mes: monthOf(shiftPeriod(target, months)) },
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
    <Box
      pos="sticky"
      top={0}
      bg="dark.7"
      py="xs"
      className={appLayout.mobileRule}
      style={{ zIndex: 1 }}
    >
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(0, 400px) 1fr",
          alignItems: "center",
          gap: "var(--mantine-spacing-sm)",
        }}
      >
        <Box />
        <Group justify="space-between" wrap="nowrap">
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
            {formatPeriod(target)}
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
        <Box />
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

function Summary({
  summary,
  excluded,
  onClose,
}: {
  summary: PeriodSummary;
  /** Hides the summary; it comes back from the settings. */
  onClose: () => void;
  /** Whether the month holds a skipped or "A definir" item the totals leave out. */
  excluded: boolean;
}) {
  const id = useId();
  const leftOver = summary.inflowExpected - summary.outflowExpected;
  return (
    <Stack gap="md" pos="relative">
      <CloseButton
        pos="absolute"
        top={0}
        right={0}
        aria-label="Ocultar resumo"
        onClick={onClose}
      />
      <Box component="section" aria-labelledby={id} px="xs">
        <Text id={id} fz="xs" c="dimmed" tt="uppercase" fw={600} lts="1.5px">
          Sobra prevista
        </Text>
        <Text
          aria-labelledby={id}
          fz={{ base: 36, xs: 52 }}
          lh={1.1}
          fw={700}
          c={leftOver < 0 ? "red.5" : "white"}
        >
          {formatAmount(leftOver)}
        </Text>
      </Box>
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
      {excluded && (
        <Text fz="sm" c="dimmed" px="xs">
          O Previsto não conta contas “A definir” nem puladas.
        </Text>
      )}
    </Stack>
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
      p="md"
      radius="lg"
    >
      <Title order={2} id={`${id}-title`} fz="md" fw={600}>
        {title}
      </Title>
      <Group mt="xs" gap="xl" align="flex-end">
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
      <Text aria-labelledby={id} fz="md" fw={600} c="white">
        {formatAmount(cents)}
      </Text>
    </Stack>
  );
}

type FailureProps = {
  failures: ReadonlyMap<string, Failure>;
  onDismissFailure: (id: string) => void;
  onRetry: (request: StatusChangeRequest) => void;
};

function Occurrences({
  payload,
  onStatusChange,
  ...failureProps
}: FailureProps & {
  payload: PeriodPayload;
  onStatusChange: (request: StatusChangeRequest) => void;
}) {
  const groups = groupOccurrences(payload, today());
  const listRef = useFlip<HTMLDivElement>(payload.period);
  if (groups.length === 0) {
    return <EmptyMonth period={payload.period} />;
  }
  return (
    <Stack
      component="section"
      aria-label="Contas do mês"
      gap="xl"
      ref={listRef}
    >
      {groups.map((group) => (
        <OccurrenceList
          key={group.title}
          group={group}
          period={payload.period}
          onStatusChange={onStatusChange}
          {...failureProps}
        />
      ))}
    </Stack>
  );
}

/**
 * A month with nothing in it. A recurrence never starts before the current
 * period (PRD §5.10), so it is only offered where it would fill the month;
 * an earlier one is filled with one-offs, which is how history is entered.
 */
function EmptyMonth({ period }: { period: string }) {
  const past = period < currentPeriod();
  return (
    <Stack align="center" gap="sm" py="xl" ta="center">
      <Text c="dimmed">Nenhuma conta neste mês.</Text>
      {past ? (
        <Text fz="sm" c="dimmed" maw={360}>
          Para registrar o que aconteceu, use “Nova avulsa”.
        </Text>
      ) : (
        <>
          <Text fz="sm" c="dimmed" maw={360}>
            Cadastre o que se repete todo mês em Recorrências e ele aparece aqui
            sozinho. O que acontece uma vez só entra em “Nova avulsa”.
          </Text>
        </>
      )}
    </Stack>
  );
}

function OccurrenceList({
  group: { title, items },
  period,
  onStatusChange,
  failures,
  onDismissFailure,
  onRetry,
}: FailureProps & {
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
        fz="sm"
        c={needsYou(title) ? "yellow.4" : "dimmed"}
        tt="uppercase"
        fw={600}
        lts="1.5px"
      >
        {title}
      </Title>
      <Paper
        bg="dark.6"
        withBorder
        radius="lg"
        style={
          needsYou(title)
            ? { borderColor: "var(--mantine-color-yellow-9)" }
            : undefined
        }
      >
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
              group={title}
              period={period}
              first={index === 0}
              failure={failures.get(item.id)}
              onDismissFailure={() => onDismissFailure(item.id)}
              onRetry={onRetry}
              onStatusChange={(change) => onStatusChange({ item, change })}
            />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

/** The groups that want the reader now: the one place yellow marks content. */
const needsYou = (title: string) =>
  title === "Atrasadas" || title === "Vencem hoje";

function Row({
  item,
  group,
  period,
  first,
  failure,
  onDismissFailure,
  onRetry,
  onStatusChange,
}: {
  item: PeriodItem;
  /** Title of the group it sits in, so a move between groups can be animated. */
  group: string;
  failure: Failure | undefined;
  onDismissFailure: () => void;
  onRetry: (request: StatusChangeRequest) => void;
  /** The period on screen; an item of an earlier one is labeled with its own. */
  period: string;
  first: boolean;
  onStatusChange: (change: StatusChange) => void;
}) {
  const status = statusLabel(item, period);
  return (
    <Box
      component="li"
      data-flip-id={item.id}
      data-flip-group={group}
      px="lg"
      py="sm"
      style={
        first
          ? undefined
          : { borderTop: "1px solid var(--mantine-color-dark-5)" }
      }
    >
      <Box className={classes.row}>
        <Box className={classes.lead}>
          <Box className={classes.check}>
            <SettleCheckbox item={item} onChange={onStatusChange} />
          </Box>
          <Box className={classes.text}>
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
          </Box>
        </Box>
        <Box className={classes.trail}>
          <Amount item={item} />
          {status && (
            <Badge className={classes.badge} {...status.badge}>
              {status.label}
            </Badge>
          )}
          <Box className={classes.menu}>
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
          </Box>
        </Box>
      </Box>
      {failure && (
        <Box role="alert" className={classes.failure}>
          <Text className={classes.failureText} fz="sm">
            <Text span fw={600} c="red.4">
              Alteração não salva.
            </Text>{" "}
            {errorMessage(failure.error)}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Button
              variant="subtle"
              color="red.4"
              size="xs"
              h={{ base: 44, sm: 30 }}
              onClick={() => onRetry(failure.request)}
              aria-label={`Tentar de novo: ${item.description}`}
            >
              Tentar de novo
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              h={{ base: 44, sm: 30 }}
              onClick={onDismissFailure}
              aria-label={`Fechar aviso de ${item.description}`}
            >
              Fechar
            </Button>
          </Group>
        </Box>
      )}
    </Box>
  );
}

/**
 * The amount, led by a sign and an arrow so direction never rests on colour
 * alone; "A definir" is a button that opens the edit dialog to fill it in.
 */
function Amount({ item }: { item: PeriodItem }) {
  const inflow = item.direction === "INFLOW";
  const direction = (
    <>
      <DirectionIcon inflow={inflow} />
      <VisuallyHidden>{inflow ? "Entrada" : "Saída"}</VisuallyHidden>
    </>
  );
  if (item.amount === null) {
    return (
      <EditOccurrenceButton
        item={item}
        label={`Definir valor de ${item.description}`}
        className={classes.pending}
      >
        <Group gap={6} wrap="nowrap" className={classes.amount}>
          {direction}
          <Text fw={600} c="white" span className={classes.pendingText}>
            A definir
          </Text>
          <PencilIcon />
        </Group>
      </EditOccurrenceButton>
    );
  }
  return (
    <Group gap={6} wrap="nowrap" className={classes.amount}>
      {direction}
      <Text fw={600} c={inflow ? "green.5" : "white"} span>
        <span aria-hidden="true">{inflow ? "+" : "−"}</span>
        {formatAmount(item.amount)}
      </Text>
    </Group>
  );
}

function DirectionIcon({ inflow }: { inflow: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={inflow ? "var(--mantine-color-green-5)" : "currentColor"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none", color: "var(--mantine-color-dark-2)" }}
    >
      <path d={inflow ? "M17 7L7 17M7 9v8h8" : "M7 17L17 7M9 7h8v8"} />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none", color: "var(--mantine-color-dark-2)" }}
    >
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
    </svg>
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
