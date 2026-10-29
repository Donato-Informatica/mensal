export interface Config {
  databaseURL: string;
  /** Public origin the app is served from (PRD §8.4). */
  baseURL: string;
  secret: string;
  port: number;
  /** Resend's key and sender (ADR-0003); unset sends emails to the log. */
  email?: { apiKey: string; from: string };
  /** The VAPID keys reminders are signed with (PRD §6.8); unset, they are off. */
  vapid?: Vapid;
}

export interface Vapid {
  publicKey: string;
  privateKey: string;
  /** A `mailto:` address push services can reach the operator at. */
  subject: string;
}

/** The placeholder `BETTER_AUTH_SECRET` shipped in `.env.example`. */
const exampleSecret = "change-me-to-a-long-random-string";

/**
 * The API's settings, read from `env` (see `.env.example`). In production it
 * refuses a guessable secret or a plain-http origin (PRD §8.6). Resend's key
 * and sender come as a pair, or not at all; the three VAPID variables all
 * together, or none (PRD §8.4).
 */
export function readConfig(env: Record<string, string | undefined>): Config {
  function required(name: string): string {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set (see .env.example)`);
    return value;
  }

  const config = {
    databaseURL: required("DATABASE_URL"),
    baseURL: required("BETTER_AUTH_URL"),
    secret: required("BETTER_AUTH_SECRET"),
    port: Number(env.PORT ?? 3000),
    ...((env.RESEND_API_KEY || env.EMAIL_FROM) && {
      email: {
        apiKey: required("RESEND_API_KEY"),
        from: required("EMAIL_FROM"),
      },
    }),
    ...((env.VAPID_PUBLIC_KEY ||
      env.VAPID_PRIVATE_KEY ||
      env.VAPID_SUBJECT) && {
      vapid: {
        publicKey: required("VAPID_PUBLIC_KEY"),
        privateKey: required("VAPID_PRIVATE_KEY"),
        subject: required("VAPID_SUBJECT"),
      },
    }),
  };
  if (env.NODE_ENV === "production") {
    if (config.secret === exampleSecret || config.secret.length < 32)
      throw new Error(
        "BETTER_AUTH_SECRET must be at least 32 random characters, not the .env.example value"
      );
    if (!config.baseURL.startsWith("https://"))
      throw new Error("BETTER_AUTH_URL must be an https:// origin");
  }
  return config;
}
