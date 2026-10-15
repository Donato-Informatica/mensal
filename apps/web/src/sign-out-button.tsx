import {
  Alert,
  Box,
  Button,
  Modal,
  Stack,
  Text,
  type ButtonProps,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLogout } from "@tabler/icons-react";
import { errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import headerButton from "./header-button.module.css";
import { useSessionChange } from "./session.ts";

/**
 * Signs out once confirmed. With `iconOnlyOnPhones`, the label shows from 48em
 * up and stays the accessible name.
 */
export function SignOutButton({
  iconOnlyOnPhones,
  ...props
}: ButtonProps & { iconOnlyOnPhones?: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button
        {...props}
        onClick={open}
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
      <Modal opened={opened} onClose={close} title="Sair da conta">
        <ConfirmSignOut onCancel={close} />
      </Modal>
    </>
  );
}

function ConfirmSignOut({ onCancel }: { onCancel: () => void }) {
  const signOut = useSessionChange(
    (authClient) => authClient.signOut(),
    "/entrar"
  );

  return (
    <Stack gap="md">
      {signOut.error && (
        <Alert color="red" variant="light">
          {errorMessage(signOut.error)}
        </Alert>
      )}
      <Text>Você precisará entrar de novo para usar o Mensal.</Text>
      <DialogActions>
        <Button variant="default" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          loading={signOut.isPending}
          onClick={() => signOut.mutate()}
          data-autofocus
        >
          Sair
        </Button>
      </DialogActions>
    </Stack>
  );
}
