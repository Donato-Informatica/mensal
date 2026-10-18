import type { Log } from "./log.ts";

/** One transactional email (ADR-0003), with a plain-text twin of its HTML. */
export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Where emails go: Resend when it is configured, the log otherwise. Rejects
 * when the email could not be sent.
 */
export type SendEmail = (email: Email) => Promise<void>;

/**
 * Writes each email's text to `log` instead of sending it: local development,
 * the seed, and any deploy without Resend. A reset link then reaches the
 * administrator, who forwards it by hand.
 */
export function consoleEmail(log: Log): SendEmail {
  return async ({ to, subject, text }) => {
    log(`Email to ${to}: ${subject}\n${text}`);
  };
}

/** Sends through Resend's REST API (`POST /emails`) as `from`. */
export function resendEmail({
  apiKey,
  from,
  fetch = globalThis.fetch,
}: {
  apiKey: string;
  /** A sender on a domain verified in Resend, e.g. `Mensal <nao-responda@…>`. */
  from: string;
  fetch?: typeof globalThis.fetch;
}): SendEmail {
  return async ({ to, subject, text, html }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!response.ok)
      throw new Error(
        `Resend answered ${response.status}: ${await response.text()}`
      );
  };
}
