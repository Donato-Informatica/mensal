/**
 * Each scheme's canvas (DESIGN.md: canvas, light-canvas), also the colour of
 * the browser's own chrome and the installed app's splash and bar. Free of
 * Mantine so vite.config.ts can read it too; theme.ts builds on it, and
 * `index.html` repeats it for first paint.
 */
export const canvas = { dark: "#0a0a0a", light: "#f5f5f5" } as const;
