import type { AnyTool } from "./mcp-tool.ts";
import { readTools } from "./mcp-read-tools.ts";

/**
 * Every tool the MCP server offers (PRD §8.9). To add one, declare it with
 * `defineTool` (see `mcp-tool.ts`) in a file next to `mcp-read-tools.ts` and
 * spread that file's list in here; `mcp.ts` needs no change.
 */
export const tools: AnyTool[] = [...readTools];
