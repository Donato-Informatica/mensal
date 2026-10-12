import { ActionIcon, Alert, Center, Loader, Menu, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { errorMessage } from "./api-error.ts";
import { EditRecurrenceForm } from "./edit-recurrence.tsx";
import { recurrenceQuery } from "./recurrence-query.ts";

/**
 * The actions on the recurrence behind an occurrence row, the same as on the
 * recurrences screen (PRD §7.6).
 */
export function RecurrenceActions({
  description,
  recurrenceId,
}: {
  /** The occurrence's, naming the row. */
  description: string;
  recurrenceId: string;
}) {
  const [editing, { open, close }] = useDisclosure(false);
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
          <Menu.Item onClick={open}>Editar recorrência</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal
        opened={editing}
        onClose={close}
        title="Editar recorrência"
        centered
      >
        <RecurrenceEditor id={recurrenceId} onSaved={close} />
      </Modal>
    </>
  );
}

/** The form editing recurrence `id`, once it is loaded. */
function RecurrenceEditor({
  id,
  onSaved,
}: {
  id: string;
  onSaved: () => void;
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
  // A cached recurrence is shown at once and refetched; the form restarts
  // from the fresh one if it changed meanwhile.
  return (
    <EditRecurrenceForm
      key={data.updatedAt}
      recurrence={data}
      onSaved={onSaved}
    />
  );
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
