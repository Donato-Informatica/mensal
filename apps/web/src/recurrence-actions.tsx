import { ActionIcon, Alert, Center, Loader, Menu, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Recurrence } from "@mensal/shared";
import { useQuery } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { errorMessage } from "./api-error.ts";
import { ConfirmRecurrenceDeletion } from "./delete-recurrence.tsx";
import { EditRecurrenceForm } from "./edit-recurrence.tsx";
import { EndRecurrenceForm } from "./end-recurrence.tsx";
import { recurrenceQuery } from "./recurrence-query.ts";

type Action = "edit" | "end" | "delete";

const titles: Record<Action, string> = {
  edit: "Editar recorrência",
  end: "Encerrar recorrência",
  delete: "Excluir recorrência",
};

/**
 * The actions on a recurrence, the same on the recurrences screen and on an
 * occurrence row of the monthly screen (PRD §7.6).
 */
export function RecurrenceActions({
  description,
  recurrenceId,
}: {
  /** Names the row: the recurrence's, or the occurrence's. */
  description: string;
  recurrenceId: string;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  // Kept once the dialog closes, so its content stays through the transition.
  const [action, setAction] = useState<Action>("edit");
  const start = (next: Action) => {
    setAction(next);
    open();
  };

  return (
    <>
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Mais ações para ${description}`}
          >
            <Dots />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => start("edit")}>{titles.edit}</Menu.Item>
          <Menu.Item onClick={() => start("end")}>{titles.end}</Menu.Item>
          <Menu.Item color="red" onClick={() => start("delete")}>
            {titles.delete}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={opened} onClose={close} title={titles[action]} centered>
        <LoadedRecurrence id={recurrenceId}>
          {(recurrence) =>
            action === "edit" ? (
              // A cached recurrence is shown at once and refetched; the form
              // restarts from the fresh one if it changed meanwhile.
              <EditRecurrenceForm
                key={recurrence.updatedAt}
                recurrence={recurrence}
                onSaved={close}
              />
            ) : action === "end" ? (
              <EndRecurrenceForm recurrence={recurrence} onEnded={close} />
            ) : (
              <ConfirmRecurrenceDeletion
                recurrence={recurrence}
                onCancel={close}
                onDeleted={close}
                onEndInstead={() => setAction("end")}
              />
            )
          }
        </LoadedRecurrence>
      </Modal>
    </>
  );
}

/** `children` given recurrence `id` as it is now, once it is loaded. */
function LoadedRecurrence({
  id,
  children,
}: {
  id: string;
  children: (recurrence: Recurrence) => ReactNode;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const { data, error } = useQuery(recurrenceQuery(api, id));
  if (error) {
    return (
      <Alert color="red" variant="light">
        {errorMessage(error)}
      </Alert>
    );
  }
  if (!data) {
    return (
      <Center py="xl">
        <Loader size="sm" aria-label="Carregando" />
      </Center>
    );
  }
  return children(data);
}

function Dots() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}
