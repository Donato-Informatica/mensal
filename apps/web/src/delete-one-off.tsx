import {
  ActionIcon,
  Alert,
  Button,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import type { PeriodItem } from "@mensal/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { invalidatePeriods } from "./period-query.ts";
import classes from "./touch.module.css";

/**
 * The actions on a one-off occurrence row, ending with deleting it for good,
 * once confirmed (PRD §5.9). One of a recurrence is skipped instead, so it gets
 * no such action.
 */
export function OneOffActions({
  item,
  children,
}: {
  item: PeriodItem;
  /** Menu items listed before the deletion. */
  children?: ReactNode;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon
            className={classes.icon}
            variant="subtle"
            color="gray"
            aria-label={`Mais ações para ${item.description}`}
          >
            <IconDots size={18} aria-hidden="true" />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {children}
          <Menu.Item color="red" onClick={open}>
            Excluir
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={opened} onClose={close} title="Excluir conta">
        <ConfirmDeletion item={item} onCancel={close} onDeleted={close} />
      </Modal>
    </>
  );
}

function ConfirmDeletion({
  item,
  onCancel,
  onDeleted,
}: {
  item: PeriodItem;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.deleteOneOff(item.id),
    onSuccess: async () => {
      await invalidatePeriods(queryClient);
      onDeleted();
    },
  });

  return (
    <Stack gap="md">
      {remove.error && (
        <Alert color="red" variant="light">
          {errorMessage(remove.error)}
        </Alert>
      )}
      <Text>
        <Text span fw={600} c="bright">
          {item.description}
        </Text>{" "}
        será excluída. Isso não pode ser desfeito.
      </Text>
      <DialogActions>
        <Button variant="default" onClick={onCancel} data-autofocus>
          Cancelar
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          Excluir
        </Button>
      </DialogActions>
    </Stack>
  );
}
