import { Box, Container, Group } from "@mantine/core";
import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button.tsx";
import { Wordmark } from "./wordmark.tsx";

/** The frame of the app proper: a header with the wordmark and sign-out. */
export function AppLayout({ children }: { children: ReactNode }) {
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
        {children}
      </Container>
    </>
  );
}
