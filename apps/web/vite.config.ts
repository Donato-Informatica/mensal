import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Same origin as in production (PRD §8.4): the browser only ever talks to
    // the dev server, which forwards /api to Express. No CORS.
    proxy: { "/api": "http://localhost:3000" },
    // Better-Auth trusts only BETTER_AUTH_URL's origin: on another port every
    // sign-in fails with INVALID_ORIGIN, so a taken port is an error instead.
    strictPort: true,
  },
});
