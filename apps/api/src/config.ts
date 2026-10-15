export interface Config {
  databaseUrl: string;
  /** Public origin the app is served from (PRD §8.4). */
  baseURL: string;
  secret: string;
  port: number;
}

/** The placeholder `BETTER_AUTH_SECRET` shipped in `.env.example`. */
const exampleSecret = "change-me-to-a-long-random-string";

/**
 * The API's settings, read from `env` (see `.env.example`). In production it
 * refuses a guessable secret or a plain-http origin (PRD §8.6).
 */
export function readConfig(env: Record<string, string | undefined>): Config {
  function required(name: string): string {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set (see .env.example)`);
    return value;
  }

  const config = {
    databaseUrl: required("DATABASE_URL"),
    baseURL: required("BETTER_AUTH_URL"),
    secret: required("BETTER_AUTH_SECRET"),
    port: Number(env.PORT ?? 3000),
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
