import { Group } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./dialog.module.css";

/** A confirming dialog's buttons: Cancelar, then the act (DESIGN.md, Dialogs). */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <Group className={classes.actions} gap="sm" mt="xs" wrap="nowrap">
      {children}
    </Group>
  );
}
