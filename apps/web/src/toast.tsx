import { Text } from "@mantine/core";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import classes from "./toast.module.css";

/**
 * A notice at the bottom of the screen: `message`, then `actions`. Any other
 * prop (a role, focus or pointer handlers) goes to its container.
 */
export function Toast({
  message,
  actions,
  ...props
}: {
  message: ReactNode;
  actions: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "className" | "children">) {
  return (
    <div {...props} className={classes.toast}>
      <Text className={classes.text} fz="sm">
        {message}
      </Text>
      {actions}
    </div>
  );
}
