import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Browser APIs Mantine relies on that jsdom does not implement.
vi.stubGlobal(
  "matchMedia",
  (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) satisfies MediaQueryList
);
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);
// The router restores scroll on every navigation.
vi.stubGlobal("scrollTo", () => {});

afterEach(() => {
  cleanup();
});
