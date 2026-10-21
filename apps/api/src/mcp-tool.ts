import { today } from "@mensal/shared";
import type { ZodType, z } from "zod";
import type { OperationContext } from "./operations.ts";

/**
 * One MCP tool (PRD §8.9): a name an agent calls, the Zod schema its
 * arguments must match, and the domain operation it runs. `run` resolves to
 * the JSON the tool answers with, or throws a `Refusal` (see `mcp.ts`, which
 * turns it into an `isError` result). Declare one with {@link defineTool} and
 * list it in `mcp-tools.ts`.
 */
export interface Tool<Input extends ZodType = ZodType> {
  /** snake_case, as in the PRD §8.9 table. */
  name: string;
  /**
   * The `/api/v1` operation this tool is the twin of, e.g.
   * `GET /api/v1/recurrences/{id}`. The coverage guard test fails for a
   * mounted operation no tool names.
   */
  operation: string;
  title: string;
  /**
   * English, with GLOSSARY terms followed by their pt-BR UI term in
   * parentheses, and the rules the tool enforces.
   */
  description: string;
  /** `readOnlyHint` for reads, `destructiveHint` for the `delete_*` tools. */
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean };
  /** The arguments; checked here, so a mismatch is `INVALID_INPUT`. */
  input: Input;
  /** What `run` resolves to (an object, as `structuredContent` requires). */
  output: ZodType;
  run(context: OperationContext, input: z.output<Input>): Promise<unknown>;
}

/** A tool whatever its input, as the registry holds it. */
export type AnyTool = Tool<ZodType>;

/** Declares a tool; checks that `run` takes what `input` parses to. */
export function defineTool<Input extends ZodType>(tool: Tool<Input>): AnyTool {
  return tool as unknown as AnyTool;
}

/**
 * A read result: `data`, plus `today` (America/Sao_Paulo), because agents
 * often do not know the date (PRD §8.9). Spread an object into the result;
 * wrap a list as `{ items }`.
 */
export function withToday<Data extends object>(
  { now }: OperationContext,
  data: Data
) {
  return { ...data, today: today(now()) };
}
