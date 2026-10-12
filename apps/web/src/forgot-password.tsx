import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Link, rootRouteId, useRouteContext } from "@tanstack/react-router";
import { errorMessage, unwrap } from "./api-error.ts";
import { CardScreen } from "./card-screen.tsx";

/**
 * Asks for a password-reset link. No email is sent: the API logs the link and
 * the administrator forwards it by hand (PRD §8.2).
 */
export function ForgotPassword() {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const requestLink = useMutation({
    mutationFn: async (email: string) =>
      unwrap(
        await authClient.requestPasswordReset({
          email,
          redirectTo: "/redefinir-senha",
        })
      ),
  });

  return (
    <CardScreen
      title="Esqueci a senha"
      subtitle="Peça um link para criar uma nova senha."
    >
      {requestLink.isSuccess ? (
        <Alert color="green" variant="light">
          Se houver uma conta com este e-mail, o administrador vai enviar a você
          um link para criar uma nova senha.
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            requestLink.mutate(String(form.get("email")));
          }}
        >
          <Stack gap="md">
            {requestLink.error && (
              <Alert color="red" variant="light">
                {errorMessage(requestLink.error)}
              </Alert>
            )}
            <TextInput
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Button
              type="submit"
              loading={requestLink.isPending}
              fullWidth
              mt="xs"
            >
              Pedir link
            </Button>
          </Stack>
        </form>
      )}
      <Text fz="sm" c="dimmed" ta="center">
        Lembrou a senha?{" "}
        <Anchor component={Link} to="/entrar" fz="sm">
          Entrar
        </Anchor>
      </Text>
    </CardScreen>
  );
}
