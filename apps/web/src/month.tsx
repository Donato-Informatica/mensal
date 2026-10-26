import {
  ActionIcon,
  Box,
  Button,
  CloseButton,
  Group,
  Paper,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { MonthPicker } from "@mantine/dates";
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
import {
  IconCalendarMonth,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  rootRouteId,
  useNavigate,
  useRouteContext,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useId, useState } from "react";
import { AppLayout } from "./app-layout.tsx";
import appLayout from "./app-layout.module.css";
import { useOnline } from "./connection.tsx";
import { EditOccurrenceButton } from "./edit-occurrence.tsx";
import { ExportCsvButton } from "./export-csv-button.tsx";
import { useFlip } from "./flip.ts";
import { formatAmount, formatDayAndMonth, formatPeriod } from "./format.ts";
import classes from "./occurrence-row.module.css";
import { NewOneOffButton } from "./new-one-off.tsx";
import { groupOccurrences, type OccurrenceGroup } from "./occurrence-groups.ts";
import {
  Amount,
  FailureNotice,
  RowMenu,
  StatusBadge,
  type Failure,
  type FailureProps,
} from "./occurrence-row-parts.tsx";
import { OccurrenceTable } from "./occurrence-table.tsx";
import { OccurrenceViewBar, useOccurrenceView } from "./occurrence-view.tsx";
import { periodQuery } from "./period-query.ts";
import monthClasses from "./month.module.css";
import { monthPickerProps } from "./pickers.ts";
import { useDocumentTitle } from "./document-title.ts";
import type { SaveFailure } from "./session.ts";
import { useConfirmStatusChanges, useShowSummary } from "./settings.tsx";
import {
  ConfirmStatusChange,
  needsConfirmation,
  SettleCheckbox,
  useStatusChange,
  type StatusChangeRequest,
} from "./status-controls.tsx";
import { TrendButton, TrendModal } from "./trend.tsx";
import { UndoToast } from "./undo-toast.tsx";
import { rememberViewedMonth } from "./viewed-month.ts";

/** The monthly screen: one period's summary and occurrences. */
export function Month({ period }: { period: string }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const { data } = useSuspenseQuery(periodQuery(api, period));
  useDocumentTitle(formatPeriod(period));
  // Another month is on its way: this one stays up, dimmed, until it lands.
  const loading = useRouterState({ select: (state) => state.isLoading });
  const [showSummary, setShowSummary, summaryFailure] = useShowSummary();
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
  const [trendOpen, setTrendOpen] = useState(false);
  const online = useOnline();

  return (
    <AppLayout action={<NewOneOffButton period={period} />}>
      <Stack gap="xl">
        {/* The trend does not navigate: ← / → rest while it is open, and
            while the connection lock is on (inert does not stop keys). */}
        <PeriodNavigator arrowKeys={!trendOpen && online} />
        <Stack gap="xl" className={classes.content} aria-busy={loading}>
          {showSummary && (
            <Summary
              summary={data.summary}
              onOpenTrend={() => setTrendOpen(true)}
              onClose={() => setShowSummary(false)}
              // Closing it came back refused: the bar is back, saying so.
              closeFailure={summaryFailure}
              excluded={data.items.some(
                (item) => item.amount === null || item.status === "SKIPPED"
              )}
            />
          )}
          {/* The bar heads the occurrences it switches and exports. */}
          <Stack gap="sm">
            <OccurrenceViewBar>
              <ExportCsvButton payload={data} />
            </OccurrenceViewBar>
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
      </Stack>
      <ConfirmStatusChange
        request={confirming}
        onConfirm={(request) => {
          setConfirming(null);
          changeStatus(request);
        }}
        onCancel={() => setConfirming(null)}
      />
      <TrendModal
        period={period}
        opened={trendOpen}
        onClose={() => setTrendOpen(false)}
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

/** `< Outubro 2026 >`: one click, or ← / → while `arrowKeys`, moves a month. */
function PeriodNavigator({ arrowKeys }: { arrowKeys: boolean }) {
  const navigate = useNavigate();
  // The month asked for, which runs ahead of the one on screen while it loads:
  // the title answers a click at once and fast repeats keep stepping.
  const { search: asked, pathname } = useRouterState({
    select: (state) => state.location,
  }) as { search: { mes?: unknown }; pathname: string };
  const target =
    (typeof asked.mes === "string" ? periodOfMonth(asked.mes) : undefined) ??
    currentPeriod();
  const away = target !== currentPeriod();
  // "Mês atual" sits beside the arrow that points back to the current month.
  const backSide = target > currentPeriod() ? "start" : "end";
  const goToCurrent = (
    <Button
      variant="subtle"
      color="gray"
      size="sm"
      h={36}
      miw={36}
      px={{ base: 9, sm: "xs" }}
      radius={9999}
      aria-label="Ir para o mês atual"
      leftSection={<IconCalendarMonth size={18} aria-hidden="true" />}
      styles={{ section: { marginInlineEnd: 0 } }}
      onClick={() => void navigate({ to: "/", search: { mes: undefined } })}
    >
      <Text span visibleFrom="sm" ml={8}>
        Mês atual
      </Text>
    </Button>
  );
  const queryClient = useQueryClient();
  // The month that "Mês" reopens after a visit to another screen.
  // Leaving already changes the URL, which must not read as a return to now.
  const onMonthScreen = pathname === "/";
  useEffect(() => {
    if (onMonthScreen) {
      rememberViewedMonth(queryClient, away ? monthOf(target) : undefined);
    }
  }, [queryClient, onMonthScreen, away, target]);
  const [picking, setPicking] = useState(false);
  const jumpTo = (picked: string | null) => {
    setPicking(false);
    if (picked === null) return;
    void navigate({
      to: "/",
      search: { mes: picked === currentPeriod() ? undefined : monthOf(picked) },
    });
  };
  const move = (months: number) =>
    void navigate({
      to: "/",
      search: { mes: monthOf(shiftPeriod(target, months)) },
    });
  // Inside a dialog, the arrows belong to the dialog (e.g. a month picker).
  const moveUnlessInDialog = (months: number) => (event: KeyboardEvent) => {
    if (
      !arrowKeys ||
      (event.target instanceof Element &&
        event.target.closest('[role="dialog"]'))
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

  // Fixed at the top while the list scrolls (PRD §7.1), below the offline
  // banner while it shows (connection.tsx).
  return (
    <Box
      pos="sticky"
      top="var(--mensal-sticky-top, 0px)"
      bg="var(--mantine-color-body)"
      py="xs"
      className={appLayout.mobileRule}
      style={{ zIndex: 1 }}
    >
      <Box className={monthClasses.navigator}>
        <Group justify="flex-end">
          {away && backSide === "start" && goToCurrent}
        </Group>
        <Box className={monthClasses.stepper}>
          <ActionIcon
            variant="surface"
            size={36}
            radius={9999}
            aria-label="Mês anterior"
            onClick={() => move(-1)}
          >
            <IconChevronLeft size={20} aria-hidden="true" />
          </ActionIcon>
          <Popover opened={picking} onChange={setPicking} withArrow>
            <Popover.Target>
              {/* Shrinks with the row; a long month name wraps (DESIGN.md). */}
              <Title
                order={1}
                ta="center"
                fz={{ base: 24, xs: 32 }}
                miw={0}
                style={{ flex: "0 1 auto" }}
              >
                <Button
                  variant="subtle"
                  color="gray"
                  h="auto"
                  maw="100%"
                  px={{ base: 4, xs: "xs" }}
                  fz="inherit"
                  fw="inherit"
                  lts="inherit"
                  lh={1.2}
                  styles={{
                    label: { whiteSpace: "normal" },
                    section: { marginInlineStart: 6 },
                  }}
                  aria-haspopup="dialog"
                  title="Escolher mês"
                  rightSection={
                    <IconChevronDown size={18} aria-hidden="true" />
                  }
                  onClick={() => setPicking((open) => !open)}
                >
                  {formatPeriod(target)}
                </Button>
              </Title>
            </Popover.Target>
            <Popover.Dropdown role="dialog" aria-label="Escolher mês">
              <MonthPicker
                value={target}
                onChange={jumpTo}
                allowDeselect={false}
                {...monthPickerProps}
              />
            </Popover.Dropdown>
          </Popover>
          <ActionIcon
            variant="surface"
            size={36}
            radius={9999}
            aria-label="Próximo mês"
            onClick={() => move(1)}
          >
            <IconChevronRight size={20} aria-hidden="true" />
          </ActionIcon>
        </Box>
        <Group justify="flex-start">
          {away && backSide === "end" && goToCurrent}
        </Group>
      </Box>
    </Box>
  );
}

function Summary({
  summary,
  excluded,
  onClose,
  closeFailure,
  onOpenTrend,
}: {
  summary: PeriodSummary;
  /** Opens Evolução, the trend of the months up to this one. */
  onOpenTrend: () => void;
  /** Hides the summary; it comes back from the settings. */
  onClose: () => void;
  /** Why hiding the summary could not be saved, if it could not; retried by `onClose`. */
  closeFailure: SaveFailure | undefined;
  /** Whether the month holds a skipped or "A definir" item the totals leave out. */
  excluded: boolean;
}) {
  const id = useId();
  const leftOver = summary.inflowExpected - summary.outflowExpected;
  return (
    <Stack gap="md" pos="relative">
      <Group pos="absolute" top={0} right={0} gap={4} style={{ zIndex: 1 }}>
        <TrendButton onClick={onOpenTrend} />
        <CloseButton aria-label="Ocultar resumo" onClick={onClose} />
      </Group>
      <Box component="section" aria-labelledby={id} px="xs">
        <Text id={id} fz="xs" c="dimmed" tt="uppercase" fw={600} lts="1.5px">
          Sobra prevista
        </Text>
        {/* The dominant figure (PRD §7), at the display step: never above the title. */}
        <Text
          aria-labelledby={id}
          fz={{ base: 24, xs: 32 }}
          lh={1.2}
          lts="-1px"
          fw={700}
          c={leftOver < 0 ? "var(--mensal-color-rose)" : "bright"}
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
      {closeFailure && (
        <FailureNotice
          error={closeFailure.error}
          onRetry={onClose}
          onDismiss={closeFailure.dismiss}
        />
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
      bg="var(--mensal-color-surface-card)"
      withBorder
      p="lg"
      radius="lg"
    >
      {/* The title step, not display: no -1px tracking (DESIGN.md). */}
      <Title order={2} id={`${id}-title`} fz="md" fw={600} lts={0}>
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
      <Text
        aria-labelledby={id}
        fz={20}
        fw={700}
        lh={1.4}
        c="bright"
        className={monthClasses.figure}
      >
        {formatAmount(cents)}
      </Text>
    </Stack>
  );
}

function Occurrences({
  payload,
  onStatusChange,
  ...failureProps
}: FailureProps & {
  payload: PeriodPayload;
  onStatusChange: (request: StatusChangeRequest) => void;
}) {
  const [view] = useOccurrenceView();
  const groups = groupOccurrences(payload, today());
  const listRef = useFlip<HTMLDivElement>(payload.period);
  if (view === "table") {
    return (
      <OccurrenceTable
        payload={payload}
        empty={<EmptyMonth period={payload.period} />}
        onStatusChange={onStatusChange}
        {...failureProps}
      />
    );
  }
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
        <Text fz="sm" c="dimmed" maw={360}>
          Cadastre o que se repete todo mês em Recorrências e ele aparece aqui
          sozinho. O que acontece uma vez só entra em “Nova avulsa”.
        </Text>
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
  const needsYouGroup = needsYou(title);
  return (
    <Stack component="section" aria-labelledby={id} gap="sm">
      <Title
        order={2}
        id={id}
        fz="sm"
        c={needsYouGroup ? "var(--mensal-color-needs-you-label)" : "dimmed"}
        bg={
          needsYouGroup ? "var(--mensal-color-needs-you-fill)" : "transparent"
        }
        className={needsYouGroup ? classes.needsYouLabel : undefined}
        tt="uppercase"
        fw={600}
        lts="1.5px"
      >
        {title}
      </Title>
      <Paper
        bg="var(--mensal-color-surface-card)"
        withBorder
        radius="lg"
        style={
          needsYouGroup
            ? { borderColor: "var(--mensal-color-needs-you-edge)" }
            : undefined
        }
      >
        <Stack
          component="ul"
          aria-label={title}
          className={classes.rows}
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
          : { borderTop: "1px solid var(--mensal-color-hairline)" }
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
                <Text c="bright" fw={500} truncate>
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
          <Box className={classes.amountAndBadge}>
            <Amount item={item} />
            <Box className={classes.badgeColumn}>
              <StatusBadge item={item} period={period} />
            </Box>
          </Box>
          <Box className={classes.menu}>
            <RowMenu item={item} onChange={onStatusChange} />
          </Box>
        </Box>
      </Box>
      {failure && (
        <FailureNotice
          error={failure.error}
          subject={item.description}
          onRetry={() => onRetry(failure.request)}
          onDismiss={onDismissFailure}
        />
      )}
    </Box>
  );
}
