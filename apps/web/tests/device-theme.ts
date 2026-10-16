import { act } from "@testing-library/react";
import { vi } from "vitest";

export type Scheme = "light" | "dark";

/**
 * The device's own theme, as `prefers-color-scheme` reports it through
 * `matchMedia`, which jsdom lacks; `change` switches it as the OS would.
 */
export function deviceTheme(initial: Scheme) {
  const darkQuery = "(prefers-color-scheme: dark)";
  let current = initial;
  const listeners = new Set<EventListener>();
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        get matches() {
          return query === darkQuery && current === "dark";
        },
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_type: string, listener: EventListener) => {
          if (query === darkQuery) listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: EventListener) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => false,
      }) satisfies MediaQueryList
  );
  return {
    change(to: Scheme) {
      current = to;
      const event = Object.assign(new Event("change"), {
        matches: to === "dark",
      });
      act(() => listeners.forEach((listener) => listener(event)));
    },
  };
}

/** The scheme the page is painted in, as Mantine marks it on `<html>`. */
export function appliedScheme() {
  return document.documentElement.getAttribute("data-mantine-color-scheme");
}
