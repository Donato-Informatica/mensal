import { Anchor, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CardScreen } from "./card-screen.tsx";
import { DeleteAccountModal } from "./delete-account.tsx";
import { SignOutButton } from "./sign-out-button.tsx";

export function AwaitingApproval() {
  const [deleting, { open, close }] = useDisclosure(false);
  return (
    <CardScreen
      title="Aguardando aprovação"
      subtitle="Sua conta foi criada e está aguardando a liberação de um administrador."
    >
      <Text fz="sm">
        Quando ela for aprovada, recarregue esta página para começar a usar o
        Mensal.
      </Text>
      <SignOutButton variant="default" fullWidth />
      {/* An unapproved user can leave too (PRD §7.15). */}
      <Text fz="sm" c="dimmed" ta="center">
        <Anchor component="button" type="button" fz="sm" onClick={open}>
          Excluir conta
        </Anchor>
      </Text>
      <DeleteAccountModal opened={deleting} onClose={close} />
    </CardScreen>
  );
}
