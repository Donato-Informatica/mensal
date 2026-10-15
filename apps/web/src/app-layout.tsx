import { Box, Button, Container, Group } from "@mantine/core";
import { IconCalendarMonth, IconRepeat } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import classes from "./app-layout.module.css";
import headerButton from "./header-button.module.css";
import { SettingsButton } from "./settings.tsx";
import { SignOutButton } from "./sign-out-button.tsx";
import { Wordmark } from "./wordmark.tsx";

/** The frame of the app proper: a header with the wordmark, screens and sign-out. */
export function AppLayout({
  action,
  children,
}: {
  /**
   * The screen's primary action: floating at the bottom right on phones,
   * centered in the header from 48em up. Rendered once; CSS moves it.
   */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <Box component="header">
        <Container size="md">
          <div className={classes.bar}>
            <Wordmark markSize={28} className={classes.brand} />
            <nav aria-label="Telas" className={classes.nav}>
              <ScreenLink
                to="/"
                icon={<IconCalendarMonth size={18} aria-hidden="true" />}
              >
                Mês
              </ScreenLink>
              <ScreenLink
                to="/recorrencias"
                icon={<IconRepeat size={18} aria-hidden="true" />}
              >
                Recorrências
              </ScreenLink>
            </nav>
            {action && <div className={classes.action}>{action}</div>}
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
                iconOnlyOnPhones
              />
            </Group>
          </div>
        </Container>
      </Box>
      <Container component="main" size="md" className={classes.main}>
        {children}
      </Container>
    </>
  );
}

// DESIGN.md category-tab: the active one on surface-card, the rest muted.
function ScreenLink({
  to,
  icon,
  children,
}: {
  to: "/" | "/recorrencias";
  icon: ReactNode;
  children: string;
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
      leftSection={icon}
      classNames={{ section: headerButton.section }}
      aria-label={children}
      title={children}
      aria-current={active ? "page" : undefined}
    >
      <Box component="span" visibleFrom="sm">
        {children}
      </Box>
    </Button>
  );
}
