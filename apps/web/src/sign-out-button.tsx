import { Box, Button, Stack, Text, type ButtonProps } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { errorMessage } from "./api-error.ts";
import headerButton from "./header-button.module.css";
import { useSessionChange } from "./session.ts";

/** With `iconOnlyOnPhones`, the label shows from 48em up and stays the accessible name. */
export function SignOutButton({
  iconOnlyOnPhones,
  ...props
}: ButtonProps & { iconOnlyOnPhones?: boolean }) {
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
        {...props}
        loading={signOut.isPending}
        onClick={() => signOut.mutate()}
        {...(iconOnlyOnPhones && {
          leftSection: <IconLogout size={18} aria-hidden="true" />,
          classNames: { section: headerButton.section },
          "aria-label": "Sair",
          title: "Sair",
        })}
      >
        {iconOnlyOnPhones ? (
          <Box component="span" visibleFrom="sm">
            Sair
          </Box>
        ) : (
          "Sair"
        )}
      </Button>
    </Stack>
  );
}
