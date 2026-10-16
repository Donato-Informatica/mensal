import {
  localStorageColorSchemeManager,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { sessionQuery } from "./session.ts";
import { canvas } from "./theme.ts";

/**
 * Where this device keeps the theme it last applied: `"dark"`, `"light"` or
 * `"auto"`. `index.html` reads the same key before the app loads.
 */
export const colorSchemeCacheKey = "mensal-color-scheme";

/**
 * The device's copy of the theme, for painting before the session is known
 * (PRD §3.5): first paint and the signed-out screens. It is only a cache: once
 * the session loads, the account's theme replaces it, and it is never sent to
 * the account. A missing or unknown value paints Escuro (Mantine falls back to
 * `defaultColorScheme`).
 */
export const colorSchemeCache = localStorageColorSchemeManager({
  key: colorSchemeCacheKey,
});

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

/**
 * Tells the browser which scheme the page is painted in, for its own chrome
 * (scrollbars, form controls, a phone's address bar): `<meta
 * name="color-scheme">` and `<meta name="theme-color">`, live on Automático.
 * `index.html` sets them first, for first paint.
 */
export function useBrowserChrome() {
  const scheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: false,
  });
  useEffect(() => {
    metaNamed("color-scheme").content = scheme;
    metaNamed("theme-color").content = canvas[scheme];
  }, [scheme]);
}

function metaNamed(name: string): HTMLMetaElement {
  const found = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`
  );
  if (found) return found;
  const meta = document.createElement("meta");
  meta.name = name;
  return document.head.appendChild(meta);
}
