import { Box, Button } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import headerButton from "./header-button.module.css";

/**
 * Header link to the "Alterar senha" screen; icon-only on phones. On that
 * screen it is filled like the active screen tab, since no tab is.
 */
export function ChangePasswordLink() {
  const active = Boolean(useMatchRoute()({ to: "/alterar-senha" }));
  return (
    <Button
      component={Link}
      to="/alterar-senha"
      variant={active ? "surface" : "subtle"}
      color="gray"
      size="sm"
      h={{ base: 44, sm: 30 }}
      leftSection={<IconLock size={18} aria-hidden="true" />}
      classNames={{ section: headerButton.section }}
      aria-label="Alterar senha"
      title="Alterar senha"
      aria-current={active ? "page" : undefined}
    >
      <Box component="span" visibleFrom="sm">
        Alterar senha
      </Box>
    </Button>
  );
}
