import type { Span } from "@opentelemetry/api";
import type { IncomingMessage } from "node:http";

// The HTTP instrumentation hands each request's span to `trackRequestSpan`;
// the authentication steps later call `identifyRequest`. A WeakMap keeps the
// two apart: with telemetry off nothing is ever tracked and this is a no-op.
const spans = new WeakMap<IncomingMessage, Span>();

/** Remembers `span` as the request span of `request`. */
export function trackRequestSpan(span: Span, request: unknown): void {
  spans.set(request as IncomingMessage, span);
}

/**
 * Tags the request span of `request` with the signed-in user (`enduser.id`,
 * PRD §8.7.2): the id only, never email or name. Does nothing when telemetry
 * is off.
 */
export function identifyRequest(
  request: IncomingMessage,
  userId: string
): void {
  spans.get(request)?.setAttribute("enduser.id", userId);
}
