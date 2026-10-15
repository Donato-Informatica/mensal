import { Button } from "@mantine/core";
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
      leftSection={<PlusIcon />}
    >
      {children}
    </Button>
  );
}

// No icon library: a small inline SVG, hidden so the label alone names the button.
function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
