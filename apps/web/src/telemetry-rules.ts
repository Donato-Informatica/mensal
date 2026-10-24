/** Pure rules of the browser telemetry (PRD §8.7), kept apart from the SDK. */

/** The only build-time setting that turns telemetry on (PRD §8.7.4). */
const OTLP_PATH = "/otlp";

/** The OTLP path when `VITE_OTLP_PATH` asks for it, otherwise undefined. */
export function telemetryEndpoint(configured: string | undefined) {
  const path = configured?.replace(/\/+$/, "");
  return path === OTLP_PATH ? OTLP_PATH : undefined;
}

/** A url without its query string and fragment (PRD §8.7.2). */
export function stripQueryAndHash(url: string) {
  return url.replace(/[?#].*$/s, "");
}

/**
 * Matches every url that is NOT the app's own `/api` (relative or absolute),
 * for the fetch instrumentation's `ignoreUrls`: only `/api` is traced and gets
 * `traceparent`, so `/otlp` and anything else never is.
 */
export function notOwnApiPattern(origin: string) {
  const escaped = origin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`^(?!(?:${escaped})?/api(?:[/?#]|$))`);
}

/** Whether `url` is the app's own `/api`, the only place `traceparent` goes. */
export function isOwnApiUrl(url: string, origin: string) {
  try {
    const { origin: urlOrigin, pathname } = new URL(url, origin);
    return urlOrigin === origin && /^\/api(\/|$)/.test(pathname);
  } catch {
    return false;
  }
}
