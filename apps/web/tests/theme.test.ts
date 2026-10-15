import {
  DEFAULT_THEME,
  defaultCssVariablesResolver,
  mergeMantineTheme,
} from "@mantine/core";
import { describe, expect, it } from "vitest";
import { cssVariablesResolver, theme } from "../src/theme.ts";

type Scheme = "light" | "dark";

/**
 * The colour a CSS variable ends up as in `scheme`: Mantine's own variables
 * overlaid with the app's, every `var(--…)` followed to its value, the way
 * the browser resolves them on the page.
 */
function resolvedColour(name: string, scheme: Scheme): string {
  const full = mergeMantineTheme(DEFAULT_THEME, theme);
  const base = defaultCssVariablesResolver(full);
  const app = cssVariablesResolver(full);
  const variables: Record<string, string> = {
    ...base.variables,
    ...app.variables,
    ...base[scheme],
    ...app[scheme],
  };
  const follow = (value: string, seen: string[]): string =>
    value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => {
      if (seen.includes(inner)) throw new Error(`${inner} refers to itself`);
      const next = variables[inner];
      if (next === undefined) throw new Error(`${inner} is not defined`);
      return follow(next, [...seen, inner]);
    });
  const value = variables[name];
  if (value === undefined) throw new Error(`${name} is not defined`);
  return follow(value, [name]).toLowerCase();
}

// Expected values are DESIGN.md's tokens (front matter, `colors`).
describe("theme colours", () => {
  it("keeps the Night Ledger in the dark scheme", () => {
    expect(resolvedColour("--mantine-color-body", "dark")).toBe("#0a0a0a");
    expect(resolvedColour("--mantine-color-text", "dark")).toBe("#cccccc");
    expect(resolvedColour("--mantine-color-bright", "dark")).toBe("#ffffff");
    expect(resolvedColour("--mantine-color-dimmed", "dark")).toBe("#888888");
    expect(resolvedColour("--mensal-color-surface-card", "dark")).toBe(
      "#1a1a1a"
    );
    expect(resolvedColour("--mensal-color-hairline", "dark")).toBe("#2a2a2a");
    expect(resolvedColour("--mensal-color-hairline-strong", "dark")).toBe(
      "#3a3a3a"
    );
    expect(resolvedColour("--mensal-color-inflow", "dark")).toBe("#22c55e");
    expect(resolvedColour("--mensal-color-rose", "dark")).toBe("#ef4444");
  });

  it("puts the same roles on paper in the light scheme", () => {
    expect(resolvedColour("--mantine-color-body", "light")).toBe("#f5f5f5");
    expect(resolvedColour("--mantine-color-text", "light")).toBe("#333333");
    expect(resolvedColour("--mantine-color-bright", "light")).toBe("#0a0a0a");
    expect(resolvedColour("--mantine-color-dimmed", "light")).toBe("#666666");
    expect(resolvedColour("--mantine-color-placeholder", "light")).toBe(
      "#a3a3a3"
    );
    expect(resolvedColour("--mensal-color-surface-card", "light")).toBe(
      "#ffffff"
    );
    expect(resolvedColour("--mantine-color-default", "light")).toBe("#ffffff");
    expect(resolvedColour("--mensal-color-hairline", "light")).toBe("#e5e5e5");
    expect(resolvedColour("--mensal-color-hairline-strong", "light")).toBe(
      "#d4d4d4"
    );
    expect(resolvedColour("--mantine-color-default-border", "light")).toBe(
      "#d4d4d4"
    );
    expect(resolvedColour("--mensal-color-inflow", "light")).toBe("#15803d");
    expect(resolvedColour("--mensal-color-rose", "light")).toBe("#dc2626");
    expect(resolvedColour("--mantine-color-red-filled", "light")).toBe(
      "#dc2626"
    );
  });

  it("lets yellow mark lines and text only in the dark scheme", () => {
    for (const role of [
      "--mensal-color-highlight",
      "--mensal-color-wordmark",
      "--mensal-color-needs-you-label",
    ]) {
      expect(resolvedColour(role, "dark")).toBe("#faff69");
    }
    expect(resolvedColour("--mantine-color-anchor", "dark")).toBe("#faff69");
  });

  it("turns yellow lines and text to ink on paper, keeping yellow as a fill", () => {
    for (const role of [
      "--mantine-color-anchor",
      "--mensal-color-highlight",
      "--mensal-color-wordmark",
      "--mensal-color-needs-you-label",
      "--mensal-color-needs-you-edge",
      "--mensal-color-filled-control-edge",
    ]) {
      expect(resolvedColour(role, "light")).toBe("#0a0a0a");
    }
    expect(resolvedColour("--mensal-color-needs-you-fill", "light")).toBe(
      "#faff69"
    );
    expect(resolvedColour("--mantine-primary-color-filled", "light")).toBe(
      "#faff69"
    );
  });
});
