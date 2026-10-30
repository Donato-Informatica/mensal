import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { canvas } from "./src/canvas.ts";

export default defineConfig({
  plugins: [
    react(),
    // As nginx does (apps/web/nginx.conf), /guia redirects to /guia/; the
    // guide's dev server, behind the /guia proxy below, only answers its base.
    {
      name: "mensal-guide-redirect",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== "/guia" && !req.url?.startsWith("/guia?"))
            return next();
          res.statusCode = 301;
          res.setHeader("Location", `/guia/${req.url.slice("/guia".length)}`);
          res.end();
        });
      },
    },
    // Installable, online only (PRD §7.16, ADR-0006): the service worker
    // (src/sw.ts, built into sw.js) precaches the built shell and nothing
    // else. Only the production build registers it (registerSW.js in
    // index.html); dev and the web tests never do.
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
      },
    }),
  ],
  server: {
    // Same origin as in production (PRD §8.4): the browser only ever talks to
    // the dev server, which forwards /api to Express. No CORS.
    // /otlp is the browser's telemetry ingest (PRD §8.7.4): locally the
    // otel-lgtm container of docker-compose.yml, in production nginx → Collector.
    // /guia/ is the guide's own dev server (PRD §8.4: nginx serves it in
    // production), so the app's links into the guide work locally too.
    proxy: {
      "/api": "http://localhost:3000",
      "^/guia/": { target: "http://localhost:5174", ws: true },
      // The Collector serves /v1/traces and /v1/logs at its root.
      "/otlp": {
        target: "http://localhost:4318",
        rewrite: (path) => path.replace(/^\/otlp/, ""),
      },
    },
    // Better-Auth trusts only BETTER_AUTH_URL's origin: on another port every
    // sign-in fails with INVALID_ORIGIN, so a taken port is an error instead.
    strictPort: true,
  },
});
