import { telemetryEndpoint } from "./telemetry-rules.ts";

/**
 * Starts browser telemetry (PRD §8.7.4). A no-op unless the build sets
 * `VITE_OTLP_PATH=/otlp`; then the SDK chunk loads on the side. Never throws
 * into the app, and never blocks its first render.
 */
export function startTelemetry() {
  const endpoint = telemetryEndpoint(import.meta.env.VITE_OTLP_PATH);
  if (!endpoint) return;
  const environment =
    import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT ||
    (import.meta.env.DEV ? "local" : "production");
  import("./telemetry-sdk.ts")
    .then((sdk) => sdk.startSdk(endpoint, environment))
    .catch(() => {});
}
