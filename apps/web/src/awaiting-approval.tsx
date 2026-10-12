import { Text } from "@mantine/core";
import { CardScreen } from "./card-screen.tsx";
import { SignOutButton } from "./sign-out-button.tsx";

export function AwaitingApproval() {
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
    </CardScreen>
  );
}
