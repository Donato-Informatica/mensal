import { Box, Button } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import headerButton from "./header-button.module.css";

/** Header link to the "Alterar senha" screen; icon-only on phones. */
export function ChangePasswordLink() {
  return (
    <Button
      component={Link}
      to="/alterar-senha"
      variant="subtle"
      color="gray"
      size="sm"
      h={{ base: 44, sm: 30 }}
      leftSection={<IconLock size={18} aria-hidden="true" />}
      classNames={{ section: headerButton.section }}
      aria-label="Alterar senha"
      title="Alterar senha"
    >
      <Box component="span" visibleFrom="sm">
        Alterar senha
      </Box>
    </Button>
  );
}
