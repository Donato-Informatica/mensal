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

const MAX_EXPORTED_LENGTH = 1000;

/**
 * `message` as it may leave the process (PRD §8.7.2). Error text can echo
 * user data: email addresses, quoted values, and the values Postgres puts in
 * `Key (column)=(value)` and `Failing row contains (...)` details are masked,
 * and the result is truncated.
 */
export function sanitizeForExport(message: string): string {
  return message
    .replace(emailAddress, "[email]")
    .replace(/\(([^()\n]*)\)=\([^\n]*?\)(?= |$|\.)/g, "($1)=([value])")
    .replace(/(contains) \(.*\)/g, "$1 ([values])")
    .replace(/"[^"\n]*"/g, '"[value]"')
    .replace(/'[^'\n]*'/g, "'[value]'")
    .slice(0, MAX_EXPORTED_LENGTH);
}

/**
 * An operator `Log` that writes through `write` (stdout or stderr, as before,
 * unchanged) and also exports the line as a log record, `ERROR` unless said
 * otherwise. The exported copy is sanitized (`sanitizeForExport`).
 */
export function exportedLog(write: Log, severity: Severity = "ERROR"): Log {
  return (message) => {
    write(message);
    emitLog(severity, sanitizeForExport(message));
  };
}
