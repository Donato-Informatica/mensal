import {
  Alert,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Link, rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ApiError, errorMessage, unwrap } from "./api-error.ts";
import { AppLayout } from "./app-layout.tsx";
import { useSession } from "./session.ts";

/**
 * Replaces the password, proven with the current one. The API then signs the
 * user out of their other devices and keeps this one (PRD §8.2).
 */
export function ChangePassword() {
  return (
    <AppLayout>
      <Stack gap="xl" maw={420}>
        <Stack gap={4}>
          <Title order={1}>Alterar senha</Title>
          <Text c="dimmed" fz="sm">
            Seus outros dispositivos serão desconectados.
          </Text>
        </Stack>
        <Paper
          bg="var(--mensal-color-surface-card)"
          withBorder
          p="xl"
          radius="lg"
        >
          <ChangePasswordForm />
        </Paper>
      </Stack>
    </AppLayout>
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

function ChangePasswordForm() {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const { email } = useSession().user;
  const currentPassword = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
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
        <Button component={Link} to="/" fullWidth>
          Voltar para o mês
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
