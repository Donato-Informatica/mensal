import type { Response } from "express";
import { Refusal } from "./refusal.ts";

/**
 * Answers with `status` and what `run` resolves to (nothing for a 204), or
 * with the status and body of the Refusal it throws. Any other error goes on
 * to the error handler.
 */
export async function answer(
  res: Response,
  status: number,
  run: () => Promise<unknown>
) {
  try {
    const body = await run();
    if (status === 204) res.status(204).end();
    else res.status(status).json(body);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    res.status(error.status).json(error.body);
  }
}
