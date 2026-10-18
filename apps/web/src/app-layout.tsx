import { Box, Button, Container } from "@mantine/core";
import { IconCalendarMonth, IconRepeat } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AccountMenu } from "./account-menu.tsx";
import classes from "./app-layout.module.css";
import { useViewedMonth } from "./viewed-month.ts";
import { Wordmark } from "./wordmark.tsx";

/** The frame of the app proper: a header with the wordmark, screens and account menu. */
export function AppLayout({
  action,
  children,
}: {
  /**
   * The screen's primary action: floating at the bottom right on phones,
   * beside the account avatar in the header from 48em up. Rendered once; CSS moves it.
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
            <div className={classes.actions}>
              <AccountMenu />
            </div>
          </div>
        </Container>
      </Box>
      <Container component="main" size="md" className={classes.main}>
        {children}
      </Container>
    </>
  );
}

// DESIGN.md category-tab, muted; the current screen's own is left out.
function ScreenLink({
  to,
  icon,
  children,
}: {
  to: "/" | "/recorrencias";
  icon: ReactNode;
  children: string;
}) {
  // The monthly screen reopens on the month last viewed.
  const viewed = useViewedMonth();
  if (useMatchRoute()({ to })) return null;
  return (
    <Button
      renderRoot={(props) =>
        to === "/" ? (
          <Link to="/" search={{ mes: viewed }} {...props} />
        ) : (
          <Link to={to} {...props} />
        )
      }
      variant="subtle"
      color="gray"
      size="sm"
      h={{ base: 44, sm: 30 }}
      leftSection={icon}
    >
      {children}
    </Button>
  );
}
