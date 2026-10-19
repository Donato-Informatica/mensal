import { Badge, Box, Group, Paper, Table, Text } from "@mantine/core";
import { VisuallyHidden } from "@mantine/core";
import { today, type PeriodPayload } from "@mensal/shared";
import { IconArrowDownLeft, IconArrowUpRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { formatAmount, formatDate } from "./format.ts";
import { occurrenceRows, type OccurrenceRow } from "./occurrence-rows.ts";
import classes from "./occurrence-table.module.css";

/**
 * The period's occurrences as one table, in the list's group order, with
 * every field of each (PRD §7.4). `empty` shows when there is nothing to list.
 */
export function OccurrenceTable({
  payload,
  empty,
}: {
  payload: PeriodPayload;
  empty: ReactNode;
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
            <Table.Th>Descrição</Table.Th>
            <Table.Th>Vencimento</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th ta="right">Valor</Table.Th>
            <Table.Th>Situação</Table.Th>
            <Table.Th>Liquidada em</Table.Th>
            <Table.Th>Origem</Table.Th>
            <Table.Th>Notas</Table.Th>
            <Table.Th>
              <VisuallyHidden>Ações</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <TableRow key={row.item.id} row={row} />
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function TableRow({ row: { item, situation } }: { row: OccurrenceRow }) {
  const inflow = item.direction === "INFLOW";
  const DirectionIcon = inflow ? IconArrowDownLeft : IconArrowUpRight;
  const needsYou = situation === "Atrasada" || situation === "Vence hoje";
  return (
    <Table.Tr className={needsYou ? classes.needsYou : undefined}>
      <Table.Td />
      <Table.Td>
        <Text c="bright" fw={500} className={classes.clip}>
          {item.description}
        </Text>
      </Table.Td>
      <Table.Td className={classes.nowrap}>
        {item.dueDate === null ? "Sem vencimento" : formatDate(item.dueDate)}
      </Table.Td>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <DirectionIcon
            size={14}
            stroke={2.5}
            color={inflow ? "var(--mensal-color-inflow)" : undefined}
            style={{ flex: "none" }}
            aria-hidden="true"
          />
          {inflow ? "Entrada" : "Saída"}
        </Group>
      </Table.Td>
      <Table.Td className={classes.amount}>
        {item.amount === null ? (
          <Text span fw={600} c="bright">
            A definir
          </Text>
        ) : (
          <Text
            span
            fw={600}
            c={inflow ? "var(--mensal-color-inflow)" : "bright"}
          >
            <span aria-hidden="true">{inflow ? "+" : "−"}</span>
            {formatAmount(item.amount)}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge variant={situation === "Atrasada" ? "overdue" : "default"}>
          {situation}
        </Badge>
      </Table.Td>
      <Table.Td className={classes.nowrap}>
        {item.settledAt === null ? "" : formatDate(item.settledAt)}
      </Table.Td>
      <Table.Td>
        {item.recurrenceId === null ? "Avulsa" : "Recorrência"}
      </Table.Td>
      <Table.Td>
        {item.notes && (
          <Box className={classes.clip} title={item.notes}>
            {item.notes}
          </Box>
        )}
      </Table.Td>
      <Table.Td />
    </Table.Tr>
  );
}
