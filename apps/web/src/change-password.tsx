import {
  Alert,
  Button,
  Checkbox,
  Modal,
  PasswordInput,
  Stack,
} from "@mantine/core";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ApiError, errorMessage, unwrap } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { useSession } from "./session.ts";

const changePasswordKey = ["change-password"];

/**
 * The "Alterar senha" modal, opened from the account menu. It stays open while
 * the change is in flight, so its outcome is always seen.
 */
export function ChangePasswordModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const pending = useIsMutating({ mutationKey: changePasswordKey }) > 0;
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!pending) onClose();
      }}
      closeOnClickOutside={false}
      title="Alterar senha"
    >
      <ChangePasswordForm onDone={onClose} />
    </Modal>
  );
}

/** Whether a failure is the current password not being the account's. */
function isWrongCurrentPassword(error: unknown) {
  return error instanceof ApiError && error.code === "INVALID_PASSWORD";
}

/** Focuses a field with its text selected, so typing replaces it. */
function retype(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

/** What the user asked a password change to revoke. */
interface Revocation {
  revokeOtherSessions: boolean;
  revokeAccessTokens: boolean;
}

function changedMessage({
  revokeOtherSessions,
  revokeAccessTokens,
}: Revocation) {
  return [
    "Senha alterada.",
    revokeOtherSessions &&
      "Nos outros dispositivos, entre de novo com a nova senha.",
    revokeAccessTokens && "Os tokens de acesso foram revogados.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Replaces the password, proven with the current one, and revokes what the
 * user chose: the other devices and the access tokens. This device always
 * stays signed in (PRD §8.2).
 */
function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const { email } = useSession().user;
  const currentPassword = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationKey: changePasswordKey,
    mutationFn: async (
      change: Revocation & { currentPassword: string; newPassword: string }
    ) => unwrap(await authClient.changePassword(change)),
    onError: (error) => {
      if (isWrongCurrentPassword(error)) retype(currentPassword.current);
    },
  });
  // A wrong current password is that field's error; anything else, the form's.
  const wrongCurrentPassword = isWrongCurrentPassword(change.error);

  if (change.isSuccess) {
    return (
      <Stack gap="md">
        <Alert color="green" variant="light">
          {changedMessage(change.variables)}
        </Alert>
        <Button onClick={onDone} fullWidth>
          Fechar
        </Button>
      </Stack>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const newPassword = String(form.get("newPassword"));
        if (newPassword !== String(form.get("confirmation"))) {
          setMismatch(true);
          retype(confirmation.current);
          return;
        }
        change.mutate({
          currentPassword: String(form.get("currentPassword")),
          newPassword,
          revokeOtherSessions: form.get("revokeOtherSessions") === "on",
          revokeAccessTokens: form.get("revokeAccessTokens") === "on",
        });
      }}
    >
      {/* Tells password managers whose password this is. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <Stack gap="md">
        {change.error && !wrongCurrentPassword && (
          <Alert color="red" variant="light">
            {errorMessage(change.error)}
          </Alert>
        )}
        <PasswordInput
          ref={currentPassword}
          label="Senha atual"
          name="currentPassword"
          autoComplete="current-password"
          required
          error={wrongCurrentPassword && errorMessage(change.error)}
          aria-invalid={wrongCurrentPassword}
          onChange={() => {
            if (wrongCurrentPassword) change.reset();
          }}
        />
        <PasswordInput
          label="Nova senha"
          description="Pelo menos 8 caracteres."
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          required
          onChange={() => setMismatch(false)}
        />
        <PasswordInput
          ref={confirmation}
          label="Confirmar nova senha"
          name="confirmation"
          autoComplete="new-password"
          required
          error={mismatch && "As senhas não conferem."}
          aria-invalid={mismatch}
          onChange={() => setMismatch(false)}
        />
        <Checkbox
          label="Desconectar dos outros dispositivos"
          name="revokeOtherSessions"
          defaultChecked
        />
        <Checkbox
          label="Revogar todos os tokens de acesso"
          name="revokeAccessTokens"
          defaultChecked
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
            Salvar senha
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}
