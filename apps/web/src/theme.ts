import {
  createTheme,
  PasswordInput,
  TextInput,
  Title,
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

export const theme = createTheme({
  colors: { yellow, dark },
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
