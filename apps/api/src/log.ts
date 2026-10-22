/** Where the API writes a line for the operator: the console unless a caller redirects it. */
export type Log = (message: string) => void;

/** `error` as the operator reads it: its stack when it has one. */
export function describeError(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
