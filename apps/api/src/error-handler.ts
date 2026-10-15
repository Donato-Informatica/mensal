import type { ErrorRequestHandler } from "express";

/**
 * The last middleware: every error left unanswered becomes JSON, and an
 * unexpected one is logged here and never described to the client (PRD §8.6).
 */
export function errorHandler(
  log: (message: string) => void
): ErrorRequestHandler {
  // Express tells an error handler by its four parameters, so `_next` stays.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: unknown, _req, res, _next) => {
    const type = (error as { type?: unknown } | null)?.type;
    if (type === "entity.parse.failed") {
      res.status(400).json({ code: "INVALID_INPUT", fields: [] });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ code: "PAYLOAD_TOO_LARGE" });
      return;
    }
    log(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
    res.status(500).json({ code: "INTERNAL_ERROR" });
  };
}
