import {
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDocumentTitle } from "./document-title.ts";
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
import appLayout from "./app-layout.module.css";
import classes from "./recurrences.module.css";
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
  useDocumentTitle("Recorrências");

  return (
    <AppLayout action={<NewRecurrenceButton />}>
      <Stack gap="xl">
        <Group
          justify="space-between"
          gap="md"
          pb="md"
          className={appLayout.mobileRule}
        >
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
          </Group>
        </Group>
        {data.length === 0 ? (
          <Stack align="center" gap="sm" py="xl" ta="center">
            <Text c="dimmed">
              {status === "active"
                ? "Nenhuma recorrência ativa."
                : "Nenhuma recorrência."}
            </Text>
            <Text fz="sm" c="dimmed" maw={360}>
              Uma recorrência é o que se repete todo mês, como aluguel ou
              salário: ela aparece em cada mês sozinha. Deixe o valor “A
              definir” se ele muda de mês a mês.
            </Text>
          </Stack>
        ) : (
          <Paper bg="var(--mensal-color-surface-card)" withBorder radius="lg">
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
    <li
      className={classes.row}
      style={
        first
          ? undefined
          : { borderTop: "1px solid var(--mensal-color-hairline)" }
      }
    >
      <div className={classes.text}>
        <EditRecurrenceButton recurrence={recurrence}>
          <Stack gap={0} miw={0}>
            <Text c="bright" fw={500} truncate>
              {description}
            </Text>
            <Text fz="sm" c="dimmed">
              {dueDay === null ? "Sem vencimento" : `Dia ${dueDay}`} ·{" "}
              {formatSpan(recurrence)}
            </Text>
          </Stack>
        </EditRecurrenceButton>
      </div>
      <div className={classes.figures}>
        {ended && <Badge variant="default">Encerrada</Badge>}
        <Text
          className={classes.amount}
          fw={600}
          c={
            defaultAmount === null
              ? "dimmed"
              : direction === "INFLOW"
                ? "var(--mensal-color-inflow)"
                : "bright"
          }
        >
          {defaultAmount === null ? "A definir" : formatAmount(defaultAmount)}
        </Text>
      </div>
      <RecurrenceActions
        description={description}
        recurrenceId={recurrence.id}
      />
    </li>
  );
}

/** "desde outubro 2026", or "novembro 2026 a março 2027" once it has an end. */
function formatSpan({ startPeriod, endPeriod }: Recurrence): string {
  return endPeriod === null
    ? `desde ${formatPeriodInline(startPeriod)}`
    : `${formatPeriodInline(startPeriod)} a ${formatPeriodInline(endPeriod)}`;
}
