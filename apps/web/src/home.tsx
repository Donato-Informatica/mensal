import { Box, Container, Group, Text, Title } from "@mantine/core";
import { useSession } from "./session.ts";
import { SignOutButton } from "./sign-out-button.tsx";
import { Wordmark } from "./wordmark.tsx";

export function Home() {
  const session = useSession();

  return (
    <>
      <Box
        component="header"
        style={{ borderBottom: "1px solid var(--mantine-color-dark-5)" }}
      >
        <Container size="md" h={64}>
          <Group h="100%" justify="space-between">
            <Wordmark />
            <SignOutButton variant="subtle" color="gray" size="sm" />
          </Group>
        </Container>
      </Box>
      <Container component="main" size="md" py="xl">
        <Title order={1}>Olá, {session?.user.name}</Title>
        <Text c="dimmed" mt="xs">
          Suas contas do mês aparecerão aqui.
        </Text>
      </Container>
    </>
  );
}
