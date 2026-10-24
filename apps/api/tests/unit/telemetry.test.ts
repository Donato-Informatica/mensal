import { trace } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { startTelemetry } from "../../src/telemetry.ts";

describe("startTelemetry", () => {
  it("registers nothing without OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    const telemetry = startTelemetry({ NODE_ENV: "test" });

    expect(telemetry).toBeUndefined();
    expect(
      trace.getTracerProvider().getTracer("t").startSpan("s").isRecording()
    ).toBe(false);
  });
});
