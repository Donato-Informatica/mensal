import {
  Button,
  Checkbox,
  createTheme,
  defaultVariantColorsResolver,
  Input,
  Loader,
  Menu,
  Modal,
  PasswordInput,
  Popover,
  rem,
  SegmentedControl,
  Switch,
  TextInput,
  Title,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type VariantColorsResolver,
} from "@mantine/core";
import controls from "./controls.module.css";
import dialog from "./dialog.module.css";

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

// DESIGN.md's accents, at shade 5: accent-emerald and accent-rose. Their light
// counterparts are shade 7 (light-accent-emerald) and 6 (light-accent-rose).
const green: MantineColorsTuple = [
  "#f0fdf4",
  "#dcfce7",
  "#bbf7d0",
  "#86efac",
  "#4ade80",
  "#22c55e", // accent-emerald
  "#16a34a",
  "#15803d", // light-accent-emerald
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
  "#dc2626", // light-accent-rose
  "#b91c1c",
  "#991b1b",
  "#7f1d1d",
];

/** DESIGN.md's light scheme, the `light-*` tokens that are not Mantine's own. */
const paper = {
  ink: "#0a0a0a", // light-ink
  body: "#333333", // light-body
  muted: "#666666", // light-muted
  mutedSoft: "#a3a3a3", // light-muted-soft
  hairline: "#e5e5e5", // light-hairline
  hairlineStrong: "#d4d4d4", // light-hairline-strong
  canvas: "#f5f5f5", // light-canvas
  surfaceCard: "#ffffff", // light-surface-card
  primaryDisabled: "#f2f4c8", // light-primary-disabled
} as const;

/**
 * Mantine's light scheme draws its surfaces, borders and quiet text from
 * gray[0–9], a blue-tinted grey. On paper, DESIGN.md's greys are neutral, so
 * the light scheme gets these instead; the dark scheme keeps Mantine's own.
 */
const paperGray: MantineColorsTuple = [
  "#fafafa",
  paper.canvas,
  paper.hairline,
  paper.hairlineStrong, // Mantine's panel borders
  paper.hairlineStrong, // Mantine's input borders
  paper.mutedSoft,
  paper.muted,
  "#4d4d4d",
  paper.body,
  "#1a1a1a",
];

/**
 * Two variants of the app's own, so a control can take a role rather than a
 * fixed shade (DESIGN.md: "take colours from the theme by role"):
 * - `surface`: Panel Black with ink on it (icon-button-round, category-tab-active).
 * - `overdue`: the overdue badge, rose (badge-overdue).
 * A confirming delete (filled red) carries `--mensal-color-on-danger`.
 */
const variantColorResolver: VariantColorsResolver = (input) => {
  if (input.variant === "surface") {
    return {
      background: "var(--mensal-color-surface-card)",
      hover: "var(--mantine-color-body)",
      color: "var(--mantine-color-bright)",
      border: `${rem(1)} solid transparent`,
    };
  }
  if (input.variant === "overdue") {
    return {
      background: "var(--mensal-color-overdue)",
      hover: "var(--mensal-color-overdue)",
      color: "var(--mantine-color-red-light-color)",
      border: `${rem(1)} solid transparent`,
    };
  }
  const colors = defaultVariantColorsResolver(input);
  if (input.variant === "filled" && input.color === "red") {
    return { ...colors, color: "var(--mensal-color-on-danger)" };
  }
  return colors;
};

export const theme = createTheme({
  colors: { yellow, dark, green, red },
  primaryColor: "yellow",
  primaryShade: 4,
  autoContrast: true,
  variantColorResolver,
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
  // The highlighter as a line (the focus ring, a focused field, a spinner) is
  // --mensal-color-highlight: yellow at night, ink on paper.
  focusClassName: controls.focus ?? "",
  components: {
    Loader: Loader.extend({
      defaultProps: { color: "var(--mensal-color-highlight)" },
    }),
    // Forms here ask only for what they need, so every field is required and
    // an asterisk on each would be noise.
    // A filled primary button takes the Spent Highlighter when disabled.
    Button: Button.extend({
      classNames: (
        theme,
        { variant = "filled", color = theme.primaryColor }
      ) =>
        variant === "filled" && color === theme.primaryColor
          ? { root: controls.primaryButton ?? "" }
          : {},
    }),
    TextInput: TextInput.extend({ defaultProps: { withAsterisk: false } }),
    PasswordInput: PasswordInput.extend({
      defaultProps: { withAsterisk: false },
    }),
    Input: Input.extend({ classNames: { input: controls.input } }),
    Checkbox: Checkbox.extend({ classNames: { input: controls.checkbox } }),
    Switch: Switch.extend({
      classNames: { input: controls.switchInput, track: controls.switchTrack },
    }),
    SegmentedControl: SegmentedControl.extend({
      classNames: { root: controls.segmentTrack, label: controls.segment },
    }),
    // DESIGN.md: menus and popovers (a date picker's too) are edged in Panel
    // Edge.
    Menu: Menu.extend({ classNames: { dropdown: controls.dropdown } }),
    Popover: Popover.extend({ classNames: { dropdown: controls.dropdown } }),
    // DESIGN.md, Dialogs: centred, padded like a summary block, the page
    // dimmed enough behind them that the dialog is all there is to read.
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
        padding: "lg",
        overlayProps: { backgroundOpacity: 0.75 },
        closeButtonProps: { "aria-label": "Fechar" },
      },
      classNames: {
        content: dialog.content,
        header: dialog.header,
        title: dialog.title,
        close: dialog.close,
        body: dialog.body,
      },
    }),
    Title: Title.extend({
      styles: {
        root: { color: "var(--mantine-color-bright)", letterSpacing: "-1px" },
      },
    }),
  },
});

/**
 * Each scheme's canvas (DESIGN.md: canvas, light-canvas), also the colour of
 * the browser's own chrome. `index.html` repeats them for first paint.
 */
export const canvas = { dark: dark[7], light: paper.canvas } as const;

const paperGrayVariables = Object.fromEntries(
  paperGray.map((shade, index) => [`--mantine-color-gray-${index}`, shade])
);

/**
 * Every colour role, resolved per scheme (DESIGN.md, Colors and its Light
 * scheme). Ink is Mantine's `bright`, running text its `text`, dimmed text its
 * `dimmed` and the canvas its `body`; the rest are `--mensal-color-*`. Yellow
 * is a line or text only in the dark scheme: on paper those roles turn ink
 * and yellow stays a fill (the Fill-Only Rule).
 *
 * `--mensal-primary-action-height` is the one source for the floating primary
 * action's height on phones (DESIGN.md, Buttons): the button takes it, and the
 * page and the undo toast leave room for it.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: { "--mensal-primary-action-height": "44px" },
  dark: {
    "--mensal-color-surface-card": "var(--mantine-color-dark-6)",
    "--mensal-color-hairline": "var(--mantine-color-dark-5)",
    "--mensal-color-hairline-strong": "var(--mantine-color-dark-4)",
    "--mensal-color-inflow": "var(--mantine-color-green-5)",
    "--mensal-color-rose": "var(--mantine-color-red-5)",
    "--mensal-color-rose-text": "var(--mantine-color-red-4)",
    "--mensal-color-rose-tint": "rgb(239 68 68 / 0.1)",
    "--mensal-color-rose-edge": "var(--mantine-color-red-9)",
    "--mensal-color-overdue": "var(--mantine-color-red-5)",
    "--mensal-color-on-danger": "var(--mantine-color-black)",
    "--mensal-color-highlight": "var(--mantine-primary-color-filled)",
    "--mensal-color-wordmark": "var(--mantine-color-yellow-4)",
    "--mensal-color-needs-you-label": "var(--mantine-color-yellow-4)",
    "--mensal-color-needs-you-fill": "transparent",
    "--mensal-color-needs-you-edge": "var(--mantine-color-yellow-9)",
    // The fill's own colour: no edge shows at night.
    "--mensal-color-filled-control-edge": "var(--mantine-primary-color-filled)",
    // Mantine's own, as every disabled control and segmented track at night.
    "--mensal-color-primary-disabled": "var(--mantine-color-disabled)",
    "--mensal-color-on-primary-disabled": "var(--mantine-color-disabled-color)",
    "--mensal-color-segment-track": "var(--mantine-color-dark-8)",
    "--mensal-shadow-interruption": "0 8px 24px rgb(0 0 0 / 0.5)",
  },
  light: {
    ...paperGrayVariables,
    "--mantine-color-body": paper.canvas,
    "--mantine-color-text": paper.body,
    "--mantine-color-bright": paper.ink,
    "--mantine-color-dimmed": paper.muted,
    "--mantine-color-placeholder": paper.mutedSoft,
    "--mantine-color-anchor": "var(--mantine-color-bright)",
    "--mantine-color-default": "var(--mensal-color-surface-card)",
    "--mantine-color-default-hover": "var(--mantine-color-body)",
    "--mantine-color-default-color": "var(--mantine-color-bright)",
    "--mantine-color-default-border": "var(--mensal-color-hairline-strong)",
    "--mantine-color-disabled": "var(--mensal-color-hairline)",
    "--mantine-color-disabled-color": "var(--mantine-color-placeholder)",
    "--mantine-color-disabled-border": "var(--mensal-color-hairline-strong)",
    "--mantine-color-error": "var(--mensal-color-rose)",
    "--mantine-color-red-filled": "var(--mantine-color-red-6)",
    "--mantine-color-red-filled-hover": "var(--mantine-color-red-7)",
    // A subtle primary button (Desfazer) is ink, yellow only as its hover fill.
    "--mantine-color-yellow-light-color": "var(--mantine-color-bright)",
    "--mensal-color-surface-card": paper.surfaceCard,
    "--mensal-color-hairline": paper.hairline,
    "--mensal-color-hairline-strong": paper.hairlineStrong,
    "--mensal-color-inflow": "var(--mantine-color-green-7)",
    "--mensal-color-rose": "var(--mantine-color-red-6)",
    "--mensal-color-rose-text": "var(--mantine-color-red-6)",
    "--mensal-color-rose-tint": "rgb(220 38 38 / 0.06)",
    "--mensal-color-rose-edge": "var(--mantine-color-red-2)",
    "--mensal-color-overdue": "var(--mantine-color-red-light)",
    "--mensal-color-on-danger": "var(--mantine-color-white)",
    "--mensal-color-highlight": "var(--mantine-color-bright)",
    "--mensal-color-wordmark": "var(--mantine-color-bright)",
    "--mensal-color-needs-you-label": "var(--mantine-color-bright)",
    "--mensal-color-needs-you-fill": "var(--mantine-primary-color-filled)",
    "--mensal-color-needs-you-edge": "var(--mantine-color-bright)",
    "--mensal-color-filled-control-edge": "var(--mantine-color-bright)",
    "--mensal-color-primary-disabled": paper.primaryDisabled,
    "--mensal-color-on-primary-disabled": "var(--mantine-color-dimmed)",
    // Mantine's track is the canvas, which a dialog is too.
    "--mensal-color-segment-track": "var(--mensal-color-hairline)",
    // Still an interruption over the page, but a softer one on paper.
    "--mensal-shadow-interruption": "0 8px 24px rgb(0 0 0 / 0.12)",
  },
});
