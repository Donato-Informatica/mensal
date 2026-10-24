import { register } from "node:module";
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { trackRequestSpan } from "./telemetry-context.ts";

/**
 * Lets the instrumentations patch CommonJS packages (express, pg) imported
 * from ES modules. Must run before the app is imported.
 */
export function registerModuleHooks(): void {
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
}

export interface Telemetry {
  shutdown(): Promise<void>;
}

/**
 * Starts OpenTelemetry tracing (PRD §8.7.3, ADR-0007) when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and returns undefined, registering
 * nothing, when it is not. `exporter` replaces the OTLP one, for tests. Spans
 * are exported in async batches, so an unreachable Collector never affects
 * the app.
 */
export function startTelemetry(
  env: Record<string, string | undefined>,
  { exporter }: { exporter?: SpanExporter } = {}
): Telemetry | undefined {
  if (!exporter && !env.OTEL_EXPORTER_OTLP_ENDPOINT) return undefined;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": "mensal-api",
      "deployment.environment": env.DEPLOYMENT_ENVIRONMENT || "local",
    }),
    sampler: new AlwaysOnSampler(),
    spanProcessors: [
      exporter
        ? new SimpleSpanProcessor(redacted(exporter))
        : new BatchSpanProcessor(redacted(new OTLPTraceExporter())),
    ],
    instrumentations: [
      new HttpInstrumentation({
        // Health checks are noise (PRD §8.7.3).
        ignoreIncomingRequestHook: (request) =>
          request.method === "GET" &&
          /^\/api\/health(\/|\?|$)/.test(request.url ?? ""),
        requestHook: trackRequestSpan,
      }),
      new ExpressInstrumentation(),
      // SQL keeps its parameterized text: bound values are never captured.
      // Queries outside a request (health ping, migrations) are dropped.
      new PgInstrumentation({
        enhancedDatabaseReporting: false,
        requireParentSpan: true,
      }),
    ],
  });
  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}

const withoutQuery = (url: unknown) =>
  typeof url === "string" ? url.replace(/\?.*$/, "") : url;

/** The span as it may leave the process: no query strings, no headers (PRD §8.7.2). */
function redact(span: ReadableSpan): ReadableSpan {
  const attributes: ReadableSpan["attributes"] = {};
  for (const [key, value] of Object.entries(span.attributes)) {
    if (key === "url.query" || /\.header\./.test(key)) continue;
    attributes[key] = ["url.full", "http.url", "http.target"].includes(key)
      ? (withoutQuery(value) as typeof value)
      : value;
  }
  return Object.create(span, { attributes: { value: attributes } });
}

function redacted(inner: SpanExporter): SpanExporter {
  return {
    export: (spans, done) => inner.export(spans.map(redact), done),
    shutdown: () => inner.shutdown(),
    ...(inner.forceFlush && { forceFlush: () => inner.forceFlush!() }),
  };
}
