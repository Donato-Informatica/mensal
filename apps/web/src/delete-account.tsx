import {
  Alert,
  Button,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useIsMutating } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ApiError, errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { DataDownloadFailure, useDataDownload } from "./download-data.tsx";
import { useSession, useSessionChange } from "./session.ts";

const deleteAccountKey = ["delete-account"];

/**
 * The "Excluir conta" modal (PRD §7.15), opened from the account menu or the
 * "Aguardando aprovação" screen. It stays open while the deletion is in
 * flight.
 */
export function DeleteAccountModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const pending = useIsMutating({ mutationKey: deleteAccountKey }) > 0;
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Excluir conta"
    >
      <DeleteAccountForm onCancel={onClose} />
    </Modal>
  );
}

/**
 * "Baixar meus dados", offered before the account goes (PRD §7.15): a loader
 * while the archive is built, a notice with "Tentar novamente" if it fails.
 */
function DownloadDataFirst() {
  const download = useDataDownload();
  return (
    <>
      <Button
        variant="default"
        leftSection={<IconDownload size={18} aria-hidden="true" />}
        loading={download.building}
        onClick={() => download.start()}
      >
        Baixar meus dados
      </Button>
      <DataDownloadFailure download={download} />
    </>
  );
}

/** Whether a failure is the password not being the account's. */
function isWrongPassword(error: unknown) {
  return error instanceof ApiError && error.code === "INVALID_PASSWORD";
}

/** Typed emails match whatever their case and surrounding spaces. */
function sameEmail(typed: string, email: string) {
  return typed.trim().toLowerCase() === email.toLowerCase();
}

/**
 * Deletes the account for good, proven with the current password and the
 * email typed out (ADR-0005), then lands on the sign-in screen with a notice.
 */
function DeleteAccountForm({ onCancel }: { onCancel: () => void }) {
  const { email, approved } = useSession().user;
  const password = useRef<HTMLInputElement>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const remove = useSessionChange(
    (authClient, currentPassword: string) =>
      authClient.deleteUser({ password: currentPassword }),
    "/entrar",
    { state: { accountDeleted: true }, mutationKey: deleteAccountKey }
  );
  // A wrong password is that field's error; anything else, the form's.
  const wrongPassword = isWrongPassword(remove.error);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!sameEmail(typedEmail, email)) return;
        const form = new FormData(event.currentTarget);
        remove.mutate(String(form.get("password")), {
          onError: (error) => {
            if (!isWrongPassword(error)) return;
            password.current?.focus();
            password.current?.select();
          },
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
        {remove.error && !wrongPassword && (
          <Alert color="red" variant="light">
            {errorMessage(remove.error)}
          </Alert>
        )}
        <Text>
          Sua conta e todas as suas recorrências, contas e tokens de acesso
          serão apagados para sempre. Isso não pode ser desfeito.
        </Text>
        {/* Only an approved user has data to take (PRD §7.15). */}
        {approved && <DownloadDataFirst />}
        <PasswordInput
          ref={password}
          label="Senha atual"
          name="password"
          autoComplete="current-password"
          required
          error={wrongPassword && errorMessage(remove.error)}
          aria-invalid={wrongPassword}
          onChange={() => {
            if (wrongPassword) remove.reset();
          }}
        />
        <TextInput
          label="Digite seu e-mail para confirmar"
          description={email}
          name="confirmation"
          autoComplete="off"
          value={typedEmail}
          onChange={(event) => setTypedEmail(event.currentTarget.value)}
          required
        />
        <DialogActions>
          <Button
            variant="default"
            onClick={onCancel}
            disabled={remove.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            color="red"
            loading={remove.isPending}
            disabled={!sameEmail(typedEmail, email)}
          >
            Excluir conta
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}
