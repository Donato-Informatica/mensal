import { Box, Button, Container, Group } from "@mantine/core";
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import classes from "./app-layout.module.css";
import { SettingsButton } from "./settings.tsx";
import { SignOutButton } from "./sign-out-button.tsx";
import { Wordmark } from "./wordmark.tsx";

/** The frame of the app proper: a header with the wordmark, screens and sign-out. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Box component="header" className={classes.header}>
        <Container size="md">
          <div className={classes.bar}>
            <Wordmark className={classes.brand} />
            <nav aria-label="Telas" className={classes.nav}>
              <ScreenLink to="/">Mês</ScreenLink>
              <ScreenLink to="/recorrencias">Recorrências</ScreenLink>
            </nav>
            <Group
              className={classes.actions}
              gap={4}
              wrap="nowrap"
              align="flex-start"
            >
              <SettingsButton />
              <SignOutButton
                variant="subtle"
                color="gray"
                size="sm"
                h={{ base: 44, sm: 30 }}
              />
            </Group>
          </div>
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
      h={{ base: 44, sm: 30 }}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Button>
  );
}
