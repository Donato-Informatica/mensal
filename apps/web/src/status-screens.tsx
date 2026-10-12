import { Anchor, Button, Text } from "@mantine/core";
import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { CardScreen } from "./card-screen.tsx";

export function NotFoundScreen() {
  return (
    <CardScreen
      title="Página não encontrada"
      subtitle="O endereço que você abriu não existe."
    >
      <Text fz="sm">
        <Anchor component={Link} to="/">
          Voltar ao início
        </Anchor>
      </Text>
    </CardScreen>
  );
}

export function ErrorScreen({ reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <CardScreen
      title="Algo deu errado"
      subtitle="Não foi possível carregar esta página. Verifique sua conexão e tente de novo."
    >
      <Button
        fullWidth
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Tentar novamente
      </Button>
    </CardScreen>
  );
}
