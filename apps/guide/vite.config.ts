import { defineConfig, type Plugin } from "vite";

const base = "/guia/";

/**
 * Link previews (PRD §7.17: the guide previews well when shared) need an
 * absolute og:image. With `VITE_PUBLIC_ORIGIN` (the web app's public origin,
 * a Docker build arg) the build prefixes the hashed image with it and adds
 * og:url. Unset (local builds), og:image stays root-relative and there is no
 * og:url: the page works, only previews lack the image.
 */
function absoluteSharePreview(): Plugin {
  let origin: string | undefined;
  return {
    name: "mensal-guide-share-preview",
    apply: "build",
    configResolved(config) {
      const value = config.env.VITE_PUBLIC_ORIGIN as string | undefined;
      if (!value) return;
      let url: URL | undefined;
      try {
        url = new URL(value);
      } catch {
        // Reported below.
      }
      if (!url || !/^https?:$/.test(url.protocol))
        throw new Error(
          `VITE_PUBLIC_ORIGIN must be an http(s) origin, e.g. https://mensal.example.com; got "${value}".`
        );
      origin = url.origin;
    },
    // After Vite has written the hashed asset URL into og:image, which it
    // does only once the page is emitted.
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const page = bundle["index.html"];
        if (!origin || page?.type !== "asset") return;
        page.source = String(page.source)
          .replace(
            /(<meta property="og:image" content=")(\/[^"]*")/,
            `$1${origin}$2`
          )
          .replace(
            /(<meta property="og:type"[^>]*>)/,
            `$1\n    <meta property="og:url" content="${origin}${base}" />`
          );
      },
    },
  };
}

// The guide (PRD §7.17, §8.4): a static page served by the web image's nginx
// under /guia/, so every built URL carries that prefix. Its own port, so it
// previews beside the app's dev server.
export default defineConfig({
  base,
  plugins: [absoluteSharePreview()],
  server: { port: 5174 },
  preview: { port: 5174 },
});
