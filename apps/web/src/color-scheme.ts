import { useMantineColorScheme } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { sessionQuery } from "./session.ts";

/**
 * Paints the app in the signed-in account's theme (PRD §3.5) once the session
 * is known, and again whenever it changes: at once when the user picks one,
 * and when another device's choice arrives with the session. Automático
 * follows the device's own setting, live. Signed out, the theme last applied
 * stays.
 */
export function useAccountColorScheme() {
  const { authClient } = useRouteContext({ from: rootRouteId });
  // Only listens: the route guards load the session.
  const { data: session } = useQuery({
    ...sessionQuery(authClient),
    enabled: false,
  });
  const colorScheme = session?.user.colorScheme;
  const { setColorScheme } = useMantineColorScheme();
  useEffect(() => {
    if (colorScheme) setColorScheme(colorScheme);
  }, [colorScheme, setColorScheme]);
}
