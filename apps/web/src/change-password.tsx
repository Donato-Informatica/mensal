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
import { useState } from "react";
import { errorMessage, unwrap } from "./api-error.ts";
import { AppLayout } from "./app-layout.tsx";

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

function ChangePasswordForm() {
  const { authClient } = useRouteContext({ from: rootRouteId });
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
  });

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
          return;
        }
        change.mutate({
          currentPassword: String(form.get("currentPassword")),
          newPassword,
        });
      }}
    >
      <Stack gap="md">
        {change.error && (
          <Alert color="red" variant="light">
            {errorMessage(change.error)}
          </Alert>
        )}
        <PasswordInput
          label="Senha atual"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
        <PasswordInput
          label="Nova senha"
          description="Pelo menos 8 caracteres."
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <PasswordInput
          label="Confirmar nova senha"
          name="confirmation"
          autoComplete="new-password"
          required
          error={mismatch && "As senhas não conferem."}
          onChange={() => setMismatch(false)}
        />
        <Button type="submit" loading={change.isPending} fullWidth mt="xs">
          Salvar senha
        </Button>
      </Stack>
    </form>
  );
}
