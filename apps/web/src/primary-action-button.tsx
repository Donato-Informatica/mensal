import { Button } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * The screen's primary action, handed to `AppLayout`'s `action`: the filled
 * yellow pill with a `+` before its label (DESIGN.md, Highlighter Rule). Flat,
 * with no shadow, even where it floats over the page on phones.
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
      h={{ base: 44, sm: 36 }}
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
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
