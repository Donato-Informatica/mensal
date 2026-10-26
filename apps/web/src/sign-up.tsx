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
import { MAX_NAME_LENGTH } from "@mensal/shared";
import { errorMessage } from "./api-error.ts";
import { CardScreen } from "./card-screen.tsx";
import { GuideLink } from "./guide-link.tsx";
import { useSessionChange } from "./session.ts";

export function SignUp() {
  const signUp = useSessionChange(
    (authClient, form: FormData) =>
      authClient.signUp.email({
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      }),
    "/"
  );

  return (
    <CardScreen
      title="Criar conta"
      subtitle="Sua conta passa por aprovação antes do primeiro acesso."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          signUp.mutate(new FormData(event.currentTarget));
        }}
      >
        <Stack gap="md">
          {signUp.error && (
            <Alert color="red" variant="light">
              {errorMessage(signUp.error)}
            </Alert>
          )}
          <TextInput
            label="Nome"
            name="name"
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            required
          />
          <TextInput
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <PasswordInput
            label="Senha"
            description="Pelo menos 8 caracteres."
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Button type="submit" loading={signUp.isPending} fullWidth mt="xs">
            Criar conta
          </Button>
          <Text fz="sm" c="dimmed" ta="center">
            Já tem conta?{" "}
            <Anchor component={Link} to="/entrar" fz="sm">
              Entrar
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
