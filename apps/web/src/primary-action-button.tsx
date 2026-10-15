import { Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import classes from "./primary-action-button.module.css";

/**
 * The screen's primary action, handed to `AppLayout`'s `action`: the filled
 * yellow pill with a `+` before its label (DESIGN.md, Components › Buttons).
 * Flat, with no shadow, even where it floats over the page on phones.
 */
export function PrimaryActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      radius={9999}
      className={classes.button}
      leftSection={<IconPlus size={18} aria-hidden="true" />}
    >
      {children}
    </Button>
  );
}
