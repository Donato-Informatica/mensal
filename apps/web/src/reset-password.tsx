import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Link, rootRouteId, useRouteContext } from "@tanstack/react-router";
import { ApiError, errorMessage, unwrap } from "./api-error.ts";
import { CardScreen } from "./card-screen.tsx";

/**
 * Sets a new password with the token from a reset link, or offers a new link
 * when there is no token (the link was invalid or expired).
 */
export function ResetPassword({ token }: { token: string | undefined }) {
  return (
    <CardScreen
      title="Redefinir senha"
      subtitle="Crie uma nova senha para sua conta."
    >
      {token === undefined ? (
        <>
          <Alert color="red" variant="light">
            {errorMessage(new ApiError("INVALID_TOKEN"))}
          </Alert>
          <Text fz="sm" c="dimmed" ta="center">
            <Anchor component={Link} to="/esqueci-a-senha" fz="sm">
              Pedir um novo link
            </Anchor>
          </Text>
        </>
      ) : (
        <NewPasswordForm token={token} />
      )}
    </CardScreen>
  );
}

function NewPasswordForm({ token }: { token: string }) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const reset = useMutation({
    mutationFn: async (newPassword: string) =>
      unwrap(await authClient.resetPassword({ newPassword, token })),
  });

  if (reset.isSuccess) {
    return (
      <Stack gap="md">
        <Alert color="green" variant="light">
          Senha redefinida. Entre com a nova senha.
        </Alert>
        <Button component={Link} to="/entrar" fullWidth>
          Entrar
        </Button>
      </Stack>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        reset.mutate(String(form.get("password")));
      }}
    >
      <Stack gap="md">
        {reset.error && (
          <Alert color="red" variant="light">
            {errorMessage(reset.error)}
          </Alert>
        )}
        <PasswordInput
          label="Nova senha"
          description="Pelo menos 8 caracteres."
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Button type="submit" loading={reset.isPending} fullWidth mt="xs">
          Salvar senha
        </Button>
      </Stack>
    </form>
  );
}
