import { logs, SeverityNumber } from "@opentelemetry/api";
import type { AnyValue } from "@opentelemetry/api";

/** The fields of a log record. */
export type LogAttributes = Record<string, AnyValue>;

/** Where the API writes a line for the operator: the console unless a caller redirects it. */
export type Log = (message: string) => void;

/** `error` as the operator reads it: its stack when it has one. */
export function describeError(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

export type Severity = "INFO" | "ERROR";

/**
 * Emits an OpenTelemetry log record (PRD §8.7.1) linked to the active span.
 * Does nothing when telemetry is off: the global logger provider is then a
 * no-op. The caller decides what is safe to export.
 */
export function emitLog(
  severity: Severity,
  body: string,
  attributes: LogAttributes = {}
): void {
  logs.getLogger("mensal-api").emit({
    severityNumber: SeverityNumber[severity],
    severityText: severity,
    body,
    attributes,
  });
}

const emailAddress = /[^\s<>"',;()]+@[^\s<>"',;()]+/g;

/**
 * An operator `Log` that writes through `write` (stdout or stderr, as before)
 * and also exports the line as a log record, `ERROR` unless said otherwise.
 * Email addresses in the exported copy are masked (PRD §8.7.2).
 */
export function exportedLog(write: Log, severity: Severity = "ERROR"): Log {
  return (message) => {
    write(message);
    emitLog(severity, message.replace(emailAddress, "[email]"));
  };
}
