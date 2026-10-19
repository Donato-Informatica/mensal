import { Badge, Box, Button, Group, Text, VisuallyHidden } from "@mantine/core";
import type { PeriodItem } from "@mensal/shared";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconPencil,
} from "@tabler/icons-react";
import { errorMessage } from "./api-error.ts";
import { EditOccurrenceButton } from "./edit-occurrence.tsx";
import { formatAmount, formatPeriod } from "./format.ts";
import classes from "./occurrence-row.module.css";

/** Why a change could not be saved, with a retry and a way to dismiss it. */
export function FailureNotice({
  error,
  subject,
  onRetry,
  onDismiss,
}: {
  error: unknown;
  /** What the change was to, naming the buttons where several notices may show. */
  subject?: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Box role="alert" className={classes.failure}>
      <Text className={classes.failureText} fz="sm">
        <Text span fw={600} c="var(--mensal-color-rose-text)">
          Alteração não salva.
        </Text>{" "}
        {errorMessage(error)}
      </Text>
      <Group gap={4} wrap="nowrap">
        <Button
          variant="subtle"
          color="var(--mensal-color-rose-text)"
          size="xs"
          h={{ base: 44, sm: 30 }}
          onClick={onRetry}
          aria-label={subject && `Tentar de novo: ${subject}`}
        >
          Tentar de novo
        </Button>
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          h={{ base: 44, sm: 30 }}
          onClick={onDismiss}
          aria-label={subject && `Fechar aviso de ${subject}`}
        >
          Fechar
        </Button>
      </Group>
    </Box>
  );
}

/**
 * The amount, led by a sign and an arrow so direction never rests on colour
 * alone; "A definir" is a button that opens the edit dialog to fill it in.
 */
export function Amount({ item }: { item: PeriodItem }) {
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
          <Text fw={600} c="bright" span className={classes.pendingText}>
            A definir
          </Text>
          <IconPencil
            size={14}
            style={{ flex: "none", color: "var(--mantine-color-dimmed)" }}
            aria-hidden="true"
          />
        </Group>
      </EditOccurrenceButton>
    );
  }
  return (
    <Group gap={6} wrap="nowrap" className={classes.amount}>
      {direction}
      <Text fw={600} c={inflow ? "var(--mensal-color-inflow)" : "bright"} span>
        <span aria-hidden="true">{inflow ? "+" : "−"}</span>
        {formatAmount(item.amount)}
      </Text>
    </Group>
  );
}

function DirectionIcon({ inflow }: { inflow: boolean }) {
  const Icon = inflow ? IconArrowDownLeft : IconArrowUpRight;
  return (
    <Icon
      size={14}
      stroke={2.5}
      color={inflow ? "var(--mensal-color-inflow)" : undefined}
      style={{ flex: "none", color: "var(--mantine-color-dimmed)" }}
      aria-hidden="true"
    />
  );
}

// DESIGN.md badge-pill: surface-card; overdue alone stands out in accent-rose.
const quietBadge = { variant: "default" } as const;
const overdueBadge = { variant: "overdue" } as const;

/**
 * Liquidada, Pulada, or the period of an overdue item from an earlier one;
 * nothing otherwise (an overdue item needs no badge: its group says it).
 * `period` is the one on screen.
 */
export function StatusBadge({
  item,
  period,
}: {
  item: PeriodItem;
  period: string;
}) {
  const status = statusLabel(item, period);
  if (!status) return null;
  return (
    <Badge className={classes.badge} {...status.badge}>
      {status.label}
    </Badge>
  );
}

function statusLabel(item: PeriodItem, period: string) {
  if (item.status === "SETTLED")
    return { label: "Liquidada", badge: quietBadge };
  if (item.status === "SKIPPED") return { label: "Pulada", badge: quietBadge };
  if (item.period !== period)
    return { label: formatPeriod(item.period), badge: overdueBadge };
  return undefined;
}
