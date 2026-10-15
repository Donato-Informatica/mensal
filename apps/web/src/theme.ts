import {
  createTheme,
  PasswordInput,
  TextInput,
  Title,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";

// DESIGN.md: near-black canvas, one electric yellow, Inter throughout.
const yellow: MantineColorsTuple = [
  "#feffe5",
  "#fdffcc",
  "#fcff9e",
  "#fbff80",
  "#faff69", // primary
  "#e6eb52", // primary-active
  "#c4c83a",
  "#9a9d2c",
  "#6e7020",
  "#3a3a1f", // primary-disabled
];

// Mantine's dark scheme reads text from dark[0], inputs from dark[6], the page
// from dark[7] and borders from dark[4].
const dark: MantineColorsTuple = [
  "#cccccc", // body
  "#b3b3b3",
  "#888888", // muted
  "#5a5a5a", // muted-soft
  "#3a3a3a", // hairline-strong
  "#2a2a2a", // hairline
  "#1a1a1a", // surface-card
  "#0a0a0a", // canvas
  "#060606",
  "#000000",
];

// DESIGN.md's accents, at shade 5: accent-emerald and accent-rose.
const green: MantineColorsTuple = [
  "#f0fdf4",
  "#dcfce7",
  "#bbf7d0",
  "#86efac",
  "#4ade80",
  "#22c55e", // accent-emerald
  "#16a34a",
  "#15803d",
  "#166534",
  "#14532d",
];

const red: MantineColorsTuple = [
  "#fef2f2",
  "#fee2e2",
  "#fecaca",
  "#fca5a5",
  "#f87171",
  "#ef4444", // accent-rose
  "#dc2626",
  "#b91c1c",
  "#991b1b",
  "#7f1d1d",
];

export const theme = createTheme({
  colors: { yellow, dark, green, red },
  primaryColor: "yellow",
  primaryShade: 4,
  autoContrast: true,
  black: "#0a0a0a",
  white: "#ffffff",
  fontFamily:
    '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontWeight: "700",
    sizes: { h1: { fontSize: "32px", lineHeight: "1.2" } }, // display-sm
  },
  defaultRadius: "md",
  radius: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "12px" },
  components: {
    // Forms here ask only for what they need, so every field is required and
    // an asterisk on each would be noise.
    TextInput: TextInput.extend({ defaultProps: { withAsterisk: false } }),
    PasswordInput: PasswordInput.extend({
      defaultProps: { withAsterisk: false },
    }),
    Title: Title.extend({
      styles: {
        root: { color: "var(--mantine-color-white)", letterSpacing: "-1px" },
      },
    }),
  },
});

// One source for the floating primary action's height on phones (DESIGN.md,
// Buttons): the button takes it, and the page and the undo toast leave room for it.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: { "--mensal-primary-action-height": "44px" },
  light: {},
  dark: {},
});
