import { Button, Stack, Text, type ButtonProps } from "@mantine/core";
import { errorMessage } from "./api-error.ts";
import { useSessionChange } from "./session.ts";

export function SignOutButton(props: ButtonProps) {
  const signOut = useSessionChange(
    (authClient) => authClient.signOut(),
    "/entrar"
  );

  return (
    <Stack gap={4} align={props.fullWidth ? "stretch" : "flex-end"}>
      {signOut.error && (
        <Text c="red" fz="sm">
          {errorMessage(signOut.error)}
        </Text>
      )}
      <Button
        h={{ base: 44, sm: 30 }}
        {...props}
        loading={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        Sair
      </Button>
    </Stack>
  );
}
