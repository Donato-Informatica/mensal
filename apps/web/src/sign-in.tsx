import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { errorMessage } from "./api-error.ts";
import { CardScreen } from "./card-screen.tsx";
import { useSessionChange } from "./session.ts";

export function SignIn() {
  const signIn = useSessionChange(
    (authClient, form: FormData) =>
      authClient.signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
      }),
    "/"
  );

  return (
    <CardScreen title="Entrar" subtitle="Acesse suas contas do mês.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          signIn.mutate(new FormData(event.currentTarget));
        }}
      >
        <Stack gap="md">
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
        </Stack>
      </form>
    </CardScreen>
  );
}
