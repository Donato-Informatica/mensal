# Telemetry is OpenTelemetry through our own Collector, with Grafana Cloud behind it

The API and the browser emit traces and logs with the OpenTelemetry SDKs and send them over OTLP to an `otel-collector` service in our own compose stack (PRD §8.7). The browser posts to `/otlp` on the app's own origin, which nginx forwards to the Collector. The Collector redacts and exports to Grafana Cloud's free tier. It is the only component, and its config and Coolify variables the only files, that know the backend exists. We chose Grafana Cloud over self-hosting Grafana, Loki and Tempo on the VPS because there is nothing to operate and it uses no VPS memory or disk. We may still move to self-hosting later, so the Collector is the seam that makes the move a config change. We rejected exporting straight from the apps (the browser would ship the backend credential in its bundle and need a cross-origin `connect-src`) and Grafana Faro for the browser (a Grafana-only SDK, which would tie the code to the vendor).

## Consequences

- `/otlp` is a public, unauthenticated ingest endpoint, so the errors of the sign-in and sign-up screens are captured too. Anyone can post junk to it: nginx limits its rate and body size, and the Collector drops browser attributes it doesn't expect. Browser telemetry carries no user identity; the API span it links to via `traceparent` does.
- Telemetry is never on the request's critical path. It is exported in async batches, the API does not depend on the Collector in the compose file, and `/api/health` ignores it. If the Collector is down, the telemetry is lost and the app works.
- Grafana Cloud's free-tier retention and quotas are the limits. Previews share production's stack and are told apart by `deployment.environment`.
- Grafana Cloud receives the user ids and item ids that PRD §8.7 allows, so the privacy rule of §8.7 now covers a third party too. A test guards it.
