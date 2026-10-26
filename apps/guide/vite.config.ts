import { defineConfig } from "vite";

// The guide (PRD §7.17, §8.4): a static page served by the web image's nginx
// under /guia/, so every built URL carries that prefix. Its own port, so it
// previews beside the app's dev server.
export default defineConfig({
  base: "/guia/",
  server: { port: 5174 },
  preview: { port: 5174 },
});
