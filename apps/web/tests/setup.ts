import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// One query over a whole page can take most of the 1 s default for `findBy*`
// and `waitFor` when every worker runs at once.
configure({ asyncUtilTimeout: 5_000 });

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
// Textarea autosize re-measures once fonts load.
Object.defineProperty(document, "fonts", {
  value: { addEventListener: () => {}, removeEventListener: () => {} },
});
// The router restores scroll on every navigation.
vi.stubGlobal("scrollTo", () => {});

afterEach(() => {
  cleanup();
});
