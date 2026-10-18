import {
  Alert,
  Button,
  Modal,
  Stack,
  Text,
  type ButtonProps,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { useSessionChange } from "./session.ts";

/** Signs out once confirmed. */
export function SignOutButton(props: ButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button {...props} onClick={open}>
        Sair
      </Button>
      <SignOutModal opened={opened} onClose={close} />
    </>
  );
}

/** The sign-out confirmation, opened from a button or the account menu. */
export function SignOutModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Sair da conta">
      <ConfirmSignOut onCancel={onClose} />
    </Modal>
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
