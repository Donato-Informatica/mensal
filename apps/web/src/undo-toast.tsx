import { Button, Text } from "@mantine/core";
import type { StatusChange } from "@mensal/shared";
import { useEffect, useState } from "react";
import type { StatusChangeRequest } from "./status-controls.tsx";
import classes from "./undo-toast.module.css";

/** How long a change can be taken back before the notice leaves on its own. */
const VISIBLE_MS = 8000;

/** What the notice says about `request`, after the occurrence's name. */
function outcome({ change }: StatusChangeRequest): string {
  switch (change.status) {
    case "SETTLED":
      return "liquidada.";
    case "SKIPPED":
      return "pulada.";
    case "PENDING":
      return "voltou para pendente.";
  }
}

/**
 * Confirms a status change after the fact and offers to take it back, instead
 * of asking first. Stays while the pointer or focus is on it.
 */
export function UndoToast({
  request,
  onUndo,
  onDismiss,
}: {
  request: StatusChangeRequest | null;
  onUndo: (request: StatusChangeRequest, back: StatusChange) => void;
  onDismiss: () => void;
}) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (request === null || held) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [request, held, onDismiss]);

  // The live region stays mounted so its updates are announced.
  return (
    <div role="status" aria-live="polite">
      {request && (
        <div
          key={request.item.id + request.change.status}
          className={classes.toast}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <Text className={classes.text} fz="sm">
            <Text span fw={600} c="bright">
              {request.item.description}
            </Text>{" "}
            {outcome(request)}
          </Text>
          <Button
            variant="subtle"
            size="xs"
            h={{ base: 44, sm: 30 }}
            onClick={() => onUndo(request, { status: request.item.status })}
          >
            Desfazer
          </Button>
        </div>
      )}
    </div>
  );
}
