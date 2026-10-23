import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { canvas } from "./src/canvas.ts";

export default defineConfig({
  plugins: [
    react(),
    // Installable, online only (PRD §7.16, ADR-0006): the service worker
    // precaches the built shell and nothing else. Only the production build
    // registers it (registerSW.js in index.html); dev and the web tests never do.
    VitePWA({
      strategies: "generateSW",
      injectRegister: "script",
      devOptions: { enabled: false },
      // The globPatterns below already precache the icons.
      includeManifestIcons: false,
      manifest: {
        name: "Mensal",
        short_name: "Mensal",
        lang: "pt-BR",
        display: "standalone",
        start_url: "/",
        scope: "/",
        // Escuro's canvas, the scheme the app opens in (PRD §3.5).
        background_color: canvas.dark,
        theme_color: canvas.dark,
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        navigateFallback: "/index.html",
        // /api is never cached nor answered by the shell: a navigation to
        // /api/docs goes to the network (and fails offline).
        navigateFallbackDenylist: [/^\/api(\/|$)/],
        runtimeCaching: [],
        // A new version takes over at once, with no prompt and no reload:
        // open tabs keep their shell, the next open gets the new one.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // Same origin as in production (PRD §8.4): the browser only ever talks to
    // the dev server, which forwards /api to Express. No CORS.
    proxy: { "/api": "http://localhost:3000" },
    // Better-Auth trusts only BETTER_AUTH_URL's origin: on another port every
    // sign-in fails with INVALID_ORIGIN, so a taken port is an error instead.
    strictPort: true,
  },
});
