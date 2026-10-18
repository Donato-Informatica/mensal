import {
  Alert,
  Box,
  Button,
  Modal,
  PasswordInput,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { IconLock } from "@tabler/icons-react";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ApiError, errorMessage, unwrap } from "./api-error.ts";
import headerButton from "./header-button.module.css";
import { useSession } from "./session.ts";

const changePasswordKey = ["change-password"];

/**
 * Header button that opens the "Alterar senha" modal; icon-only on phones. It
 * stays open while the change is in flight, so its outcome is always seen.
 */
export function ChangePasswordButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const pending = useIsMutating({ mutationKey: changePasswordKey }) > 0;
  return (
    <>
      <Button
        variant="subtle"
        color="gray"
        size="sm"
        h={{ base: 44, sm: 30 }}
        leftSection={<IconLock size={18} aria-hidden="true" />}
        classNames={{ section: headerButton.section }}
        aria-label="Alterar senha"
        title="Alterar senha"
        onClick={open}
      >
        <Box component="span" visibleFrom="sm">
          Alterar senha
        </Box>
      </Button>
      <Modal
        opened={opened}
        onClose={() => {
          if (!pending) close();
        }}
        title="Alterar senha"
      >
        <ChangePasswordForm onDone={close} />
      </Modal>
    </>
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

/**
 * Replaces the password, proven with the current one. The API then signs the
 * user out of their other devices and keeps this one (PRD §8.2).
 */
function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const { email } = useSession().user;
  const currentPassword = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationKey: changePasswordKey,
    mutationFn: async (passwords: {
      currentPassword: string;
      newPassword: string;
    }) =>
      unwrap(
        await authClient.changePassword({
          ...passwords,
          revokeOtherSessions: true,
        })
      ),
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
          Senha alterada. Nos outros dispositivos, entre de novo com a nova
          senha.
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
        <Text c="dimmed" fz="sm">
          Seus outros dispositivos serão desconectados.
        </Text>
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
        <Button type="submit" loading={change.isPending} fullWidth mt="xs">
          Salvar senha
        </Button>
      </Stack>
    </form>
  );
}
