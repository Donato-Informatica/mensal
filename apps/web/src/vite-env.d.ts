/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `/otlp` turns browser telemetry on (PRD §8.7.4); unset is a no-op. */
  readonly VITE_OTLP_PATH?: string;
  /** `deployment.environment`: `pr-<n>` for a preview; defaults to `local` in dev, `production` otherwise. */
  readonly VITE_DEPLOYMENT_ENVIRONMENT?: string;
}
