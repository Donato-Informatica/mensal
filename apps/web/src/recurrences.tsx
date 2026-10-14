import {
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  currentPeriod,
  isActive,
  type Recurrence,
  type RecurrenceListQuery,
} from "@mensal/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  rootRouteId,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { AppLayout } from "./app-layout.tsx";
import { EditRecurrenceButton } from "./edit-recurrence.tsx";
import { formatAmount, formatPeriodInline } from "./format.ts";
import { NewRecurrenceButton } from "./new-recurrence.tsx";
import { RecurrenceActions } from "./recurrence-actions.tsx";
import { recurrencesQuery } from "./recurrence-query.ts";

type Status = RecurrenceListQuery["status"];

/** The recurrences screen: the active ones, or all of them (PRD §7.6). */
export function Recurrences({ status }: { status: Status }) {
  const { api } = useRouteContext({ from: rootRouteId });
  const { data } = useSuspenseQuery(recurrencesQuery(api, status));
  const navigate = useNavigate();
  const period = currentPeriod();

  return (
    <AppLayout>
      <Stack gap="xl">
        <Group justify="space-between" gap="md">
          <Title order={1}>Recorrências</Title>
          <Group gap="sm">
            <SegmentedControl
              aria-label="Mostrar"
              value={status}
              onChange={(value) =>
                void navigate({
                  to: "/recorrencias",
                  search: { filtro: value === "all" ? "todas" : undefined },
                })
              }
              data={[
                { label: "Ativas", value: "active" },
                { label: "Todas", value: "all" },
              ]}
            />
            <NewRecurrenceButton />
          </Group>
        </Group>
        {data.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {status === "active"
              ? "Nenhuma recorrência ativa."
              : "Nenhuma recorrência."}
          </Text>
        ) : (
          <Paper bg="dark.6" withBorder radius="lg">
            <Stack
              component="ul"
              aria-label="Recorrências"
              gap={0}
              m={0}
              p={0}
              style={{ listStyle: "none" }}
            >
              {data.map((recurrence, index) => (
                <Row
                  key={recurrence.id}
                  recurrence={recurrence}
                  ended={!isActive(recurrence, period)}
                  first={index === 0}
                />
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>
    </AppLayout>
  );
}

function Row({
  recurrence,
  ended,
  first,
}: {
  recurrence: Recurrence;
  ended: boolean;
  first: boolean;
}) {
  const { description, defaultAmount, dueDay, direction } = recurrence;
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
      <EditRecurrenceButton recurrence={recurrence}>
        <Stack gap={0} miw={0}>
          <Text c="white" fw={500} truncate>
            {description}
          </Text>
          <Text fz="sm" c="dimmed">
            {dueDay === null ? "Sem vencimento" : `Dia ${dueDay}`} ·{" "}
            {formatSpan(recurrence)}
          </Text>
        </Stack>
      </EditRecurrenceButton>
      <Group gap="sm" wrap="nowrap">
        <Text
          fw={600}
          c={
            defaultAmount === null
              ? "dimmed"
              : direction === "INFLOW"
                ? "green.5"
                : "white"
          }
          style={{ whiteSpace: "nowrap" }}
        >
          {defaultAmount === null ? "A definir" : formatAmount(defaultAmount)}
        </Text>
        {ended && <Badge variant="default">Encerrada</Badge>}
        <RecurrenceActions
          description={description}
          recurrenceId={recurrence.id}
        />
      </Group>
    </Group>
  );
}

/** "desde outubro 2026", or "novembro 2026 a março 2027" once it has an end. */
function formatSpan({ startPeriod, endPeriod }: Recurrence): string {
  return endPeriod === null
    ? `desde ${formatPeriodInline(startPeriod)}`
    : `${formatPeriodInline(startPeriod)} a ${formatPeriodInline(endPeriod)}`;
}
