import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  Link,
  rootRouteId,
  useLocation,
  useRouteContext,
} from "@tanstack/react-router";
import { errorMessage } from "./api-error.ts";
import { CardScreen } from "./card-screen.tsx";
import { GuideLink } from "./guide-link.tsx";
import { useSessionChange } from "./session.ts";
import { checkThisDevice } from "./session-reminders.ts";

export function SignIn() {
  const { api } = useRouteContext({ from: rootRouteId });
  const signIn = useSessionChange(async (authClient, form: FormData) => {
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    // A shared browser never shows the previous user's reminders (PRD §8.2).
    if (!result.error) await checkThisDevice(api);
    return result;
  }, "/");
  // Where a deleted account's user lands (PRD §7.15).
  const accountDeleted = useLocation({
    select: (location) => location.state.accountDeleted === true,
  });

  return (
    <CardScreen title="Entrar" subtitle="Acesse suas contas do mês.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          signIn.mutate(new FormData(event.currentTarget));
        }}
      >
        <Stack gap="md">
          {accountDeleted && !signIn.error && (
            <Alert color="green" variant="light">
              Sua conta foi excluída.
            </Alert>
          )}
          {signIn.error && (
            <Alert color="red" variant="light">
              {errorMessage(signIn.error)}
            </Alert>
          )}
          <TextInput
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <PasswordInput
            label="Senha"
            name="password"
            autoComplete="current-password"
            required
          />
          <Anchor component={Link} to="/esqueci-a-senha" fz="sm" mt={-8}>
            Esqueci a senha
          </Anchor>
          <Button type="submit" loading={signIn.isPending} fullWidth mt="xs">
            Entrar
          </Button>
          <Text fz="sm" c="dimmed" ta="center">
            Ainda não tem conta?{" "}
            <Anchor component={Link} to="/cadastro" fz="sm">
              Criar conta
            </Anchor>
          </Text>
          <Text ta="center">
            <GuideLink>Como funciona</GuideLink>
          </Text>
        </Stack>
      </form>
    </CardScreen>
  );
}
