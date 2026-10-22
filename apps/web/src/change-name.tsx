import { Alert, Button, Modal, Stack, TextInput } from "@mantine/core";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { MAX_NAME_LENGTH } from "@mensal/shared";
import { useRef } from "react";
import { ApiError, errorMessage, unwrap } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { sessionQuery, useSession } from "./session.ts";

const changeNameKey = ["change-name"];

/**
 * The "Alterar nome" modal, opened from the account menu (PRD §7.13). It stays
 * open while the change is in flight, so its outcome is always seen.
 */
export function ChangeNameModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const pending = useIsMutating({ mutationKey: changeNameKey }) > 0;
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Alterar nome"
    >
      <ChangeNameForm onDone={onClose} />
    </Modal>
  );
}

/** Whether a failure is the server refusing the name itself. */
function isInvalidName(error: unknown) {
  return error instanceof ApiError && error.code === "INVALID_NAME";
}

/**
 * Replaces the name the user is addressed by, trimmed. An unchanged name
 * closes without a request; a saved one shows in the account menu at once.
 */
function ChangeNameForm({ onDone }: { onDone: () => void }) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const { name } = useSession().user;
  const field = useRef<HTMLInputElement>(null);
  const change = useMutation({
    mutationKey: changeNameKey,
    mutationFn: async (name: string) =>
      unwrap(await authClient.updateUser({ name })),
    onSuccess: (_data, name) => {
      queryClient.setQueryData(
        sessionQuery(authClient).queryKey,
        (session) => session && { ...session, user: { ...session.user, name } }
      );
      onDone();
    },
    onError: (error) => {
      if (isInvalidName(error)) {
        field.current?.focus();
        field.current?.select();
      }
    },
  });
  // A refused name is that field's error; anything else, the form's.
  const invalidName = isInvalidName(change.error);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const to = String(new FormData(event.currentTarget).get("name")).trim();
        if (to === name) onDone();
        else change.mutate(to);
      }}
    >
      <Stack gap="md">
        {change.error && !invalidName && (
          <Alert color="red" variant="light">
            {errorMessage(change.error)}
          </Alert>
        )}
        <TextInput
          ref={field}
          label="Nome"
          name="name"
          autoComplete="name"
          defaultValue={name}
          maxLength={MAX_NAME_LENGTH}
          required
          data-autofocus
          error={invalidName && errorMessage(change.error)}
          aria-invalid={invalidName}
          onChange={() => {
            if (invalidName) change.reset();
          }}
        />
        <DialogActions>
          <Button
            variant="default"
            onClick={onDone}
            disabled={change.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={change.isPending}>
            Salvar nome
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}
