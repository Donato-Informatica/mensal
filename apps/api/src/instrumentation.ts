// Loaded with `node --import ./src/instrumentation.ts` before the server, so
// express, pg and http are patched before they are first loaded (PRD §8.7.3).
// Never loaded by the tests.
import { registerModuleHooks, startTelemetry } from "./telemetry.ts";

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) registerModuleHooks();
const telemetry = startTelemetry(process.env);
process.on("SIGTERM", () => void telemetry?.shutdown());
