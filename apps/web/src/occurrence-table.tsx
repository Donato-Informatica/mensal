import { Badge, Box, Group, Paper, Table, Text } from "@mantine/core";
import { VisuallyHidden } from "@mantine/core";
import { today, type PeriodPayload, type StatusChange } from "@mensal/shared";
import { Fragment, type ReactNode } from "react";
import { EditOccurrenceButton } from "./edit-occurrence.tsx";
import { formatDate } from "./format.ts";
import { columns, directionLabel, originLabel } from "./occurrence-labels.ts";
import { occurrenceRows, type OccurrenceRow } from "./occurrence-rows.ts";
import {
  Amount,
  DirectionIcon,
  FailureNotice,
  overdueBadge,
  quietBadge,
  RowMenu,
  type Failure,
  type FailureProps,
} from "./occurrence-row-parts.tsx";
import classes from "./occurrence-table.module.css";
import {
  SettleCheckbox,
  type StatusChangeRequest,
} from "./status-controls.tsx";

/**
 * The period's occurrences as one table, in the list's group order, with
 * every field of each (PRD §7.4) and the list's own row controls (PRD §7.3,
 * §7.6). `empty` shows when there is nothing to list.
 */
export function OccurrenceTable({
  payload,
  empty,
  onStatusChange,
  failures,
  onDismissFailure,
  onRetry,
}: FailureProps & {
  payload: PeriodPayload;
  empty: ReactNode;
  onStatusChange: (request: StatusChangeRequest) => void;
}) {
  const rows = occurrenceRows(payload, today());
  if (rows.length === 0) return <>{empty}</>;
  return (
    <Paper
      component="section"
      aria-label="Contas do mês"
      bg="var(--mensal-color-surface-card)"
      withBorder
      radius="lg"
      className={classes.scroll}
      tabIndex={0}
    >
      <Table className={classes.table}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <VisuallyHidden>Liquidar</VisuallyHidden>
            </Table.Th>
            <Table.Th>{columns.description}</Table.Th>
            <Table.Th>{columns.dueDate}</Table.Th>
            <Table.Th>{columns.direction}</Table.Th>
            <Table.Th ta="right">{columns.amount}</Table.Th>
            <Table.Th>{columns.situation}</Table.Th>
            <Table.Th>{columns.settledAt}</Table.Th>
            <Table.Th>{columns.origin}</Table.Th>
            <Table.Th>{columns.notes}</Table.Th>
            <Table.Th>
              <VisuallyHidden>Ações</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <TableRow
              key={row.item.id}
              row={row}
              failure={failures.get(row.item.id)}
              onDismissFailure={() => onDismissFailure(row.item.id)}
              onRetry={onRetry}
              onStatusChange={onStatusChange}
            />
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function TableRow({
  row: { item, situation },
  failure,
  onDismissFailure,
  onRetry,
  onStatusChange,
}: {
  row: OccurrenceRow;
  failure: Failure | undefined;
  onDismissFailure: () => void;
  onRetry: (request: StatusChangeRequest) => void;
  onStatusChange: (request: StatusChangeRequest) => void;
}) {
  const inflow = item.direction === "INFLOW";
  const needsYou = situation === "Atrasada" || situation === "Vence hoje";
  const onChange = (change: StatusChange) => onStatusChange({ item, change });
  return (
    <Fragment>
      <Table.Tr className={needsYou ? classes.needsYou : undefined}>
        <Table.Td>
          <SettleCheckbox item={item} onChange={onChange} />
        </Table.Td>
        <Table.Td>
          <EditOccurrenceButton item={item} className={classes.describe}>
            <Text c="bright" fw={500} className={classes.clip}>
              {item.description}
            </Text>
          </EditOccurrenceButton>
        </Table.Td>
        <Table.Td className={classes.nowrap}>
          {item.dueDate === null ? "Sem vencimento" : formatDate(item.dueDate)}
        </Table.Td>
        <Table.Td>
          <Group gap={6} wrap="nowrap">
            <DirectionIcon inflow={inflow} />
            {directionLabel(item)}
          </Group>
        </Table.Td>
        <Table.Td className={classes.amount}>
          <Amount item={item} showDirection={false} />
        </Table.Td>
        <Table.Td>
          <Badge {...(situation === "Atrasada" ? overdueBadge : quietBadge)}>
            {situation}
          </Badge>
        </Table.Td>
        <Table.Td className={classes.nowrap}>
          {item.settledAt === null ? "" : formatDate(item.settledAt)}
        </Table.Td>
        <Table.Td>{originLabel(item)}</Table.Td>
        <Table.Td>
          {item.notes && (
            <Box className={classes.clip} title={item.notes}>
              {item.notes}
            </Box>
          )}
        </Table.Td>
        <Table.Td>
          <RowMenu item={item} onChange={onChange} />
        </Table.Td>
      </Table.Tr>
      {failure && (
        <Table.Tr className={classes.failureRow}>
          <Table.Td colSpan={10}>
            <FailureNotice
              error={failure.error}
              subject={item.description}
              onRetry={() => onRetry(failure.request)}
              onDismiss={onDismissFailure}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </Fragment>
  );
}
