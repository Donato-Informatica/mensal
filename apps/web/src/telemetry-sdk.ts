import {
  context,
  propagation,
  SeverityNumber,
  trace,
  type Attributes,
} from "@opentelemetry/api";
import {
  ExportResultCode,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
  BatchSpanProcessor,
  StackContextManager,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace";
import { notOwnApiPattern, stripQueryAndHash } from "./telemetry-rules.ts";

/** Span attributes that hold a url: they leave the browser without a query. */
const URL_ATTRIBUTES = ["url.full", "http.url", "http.target"];

/** Rewrites url attributes without query or fragment as a span ends (PRD §8.7.2). */
const urlScrubber: SpanProcessor = {
  onStart() {},
  onEnd(span: ReadableSpan) {
    const attributes = span.attributes as Attributes;
    for (const key of URL_ATTRIBUTES) {
      const value = attributes[key];
      if (typeof value === "string") attributes[key] = stripQueryAndHash(value);
    }
  },
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
};

/** Leaves document load's per-asset `resourceFetch` spans out: static assets are noise (PRD §8.7.3). */
function withoutAssetSpans(exporter: SpanExporter): SpanExporter {
  return {
    export(spans, done) {
      const kept = spans.filter((span) => span.name !== "resourceFetch");
      if (kept.length === 0) done({ code: ExportResultCode.SUCCESS });
      else exporter.export(kept, done);
    },
    shutdown: () => exporter.shutdown(),
    forceFlush: () => exporter.forceFlush?.() ?? Promise.resolve(),
  };
}

/**
 * The OpenTelemetry web SDK wiring (PRD §8.7.3), loaded lazily by
 * `startTelemetry` only when the build turns telemetry on. Document load and
 * `fetch` traces to the app's own `/api` share a trace with the API request;
 * uncaught errors become ERROR logs. Both go to `<endpoint>/v1/...` on the
 * app's origin in async batches.
 */
export function startSdk(endpoint: string, environment: string) {
  try {
    const resource = resourceFromAttributes({
      "service.name": "mensal-web",
      "deployment.environment": environment,
    });

    const tracerProvider = new TracerProvider({
      resource,
      spanProcessors: [
        urlScrubber,
        new BatchSpanProcessor({
          exporter: withoutAssetSpans(
            new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
          ),
        }),
      ],
    });
    trace.setGlobalTracerProvider(tracerProvider);
    context.setGlobalContextManager(new StackContextManager());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    const loggerProvider = new LoggerProvider({
      resource,
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
        }),
      ],
    });
    const logger = loggerProvider.getLogger("mensal-web");

    registerInstrumentations({
      tracerProvider,
      instrumentations: [
        new DocumentLoadInstrumentation(),
        // Only the app's own /api is traced (and, being same-origin, gets
        // `traceparent`); /otlp and everything else is ignored.
        new FetchInstrumentation({
          ignoreUrls: [notOwnApiPattern(window.location.origin)],
        }),
      ],
    });

    const report = (error: unknown, fallbackMessage: string) => {
      try {
        const attributes: Attributes = {
          "url.path": window.location.pathname,
        };
        let body = fallbackMessage;
        if (error instanceof Error) {
          body = error.message || fallbackMessage;
          attributes["exception.type"] = error.name;
          if (error.stack) attributes["exception.stacktrace"] = error.stack;
        } else if (typeof error === "string") {
          body = error;
        }
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: "ERROR",
          body,
          attributes,
        });
      } catch {
        // Telemetry never affects the app.
      }
    };
    window.addEventListener("error", (event) =>
      report(event.error ?? event.message, "Uncaught error")
    );
    window.addEventListener("unhandledrejection", (event) =>
      report(event.reason, "Unhandled promise rejection")
    );
  } catch {
    // Telemetry never affects the app.
  }
}
