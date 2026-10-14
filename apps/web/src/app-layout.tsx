import { Box, Button, Container, Group } from "@mantine/core";
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SettingsButton } from "./settings.tsx";
import { SignOutButton } from "./sign-out-button.tsx";
import { Wordmark } from "./wordmark.tsx";

/** The frame of the app proper: a header with the wordmark, screens and sign-out. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Box
        component="header"
        style={{ borderBottom: "1px solid var(--mantine-color-dark-5)" }}
      >
        <Container size="md" h={64}>
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="lg" wrap="nowrap">
              <Wordmark />
              <Group component="nav" aria-label="Telas" gap={4} wrap="nowrap">
                <ScreenLink to="/">Mês</ScreenLink>
                <ScreenLink to="/recorrencias">Recorrências</ScreenLink>
              </Group>
            </Group>
            <Group gap={4} wrap="nowrap" align="flex-start">
              <SettingsButton />
              <SignOutButton variant="subtle" color="gray" size="sm" />
            </Group>
          </Group>
        </Container>
      </Box>
      <Container component="main" size="md" py="xl">
        {children}
      </Container>
    </>
  );
}

// DESIGN.md category-tab: the active one on surface-card, the rest muted.
function ScreenLink({
  to,
  children,
}: {
  to: "/" | "/recorrencias";
  children: ReactNode;
}) {
  const active = Boolean(useMatchRoute()({ to }));
  return (
    <Button
      component={Link}
      to={to}
      variant={active ? "filled" : "subtle"}
      color={active ? "dark.6" : "gray"}
      size="sm"
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Button>
  );
}
