import { schema, type Database } from "@mensal/database";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { eq } from "drizzle-orm";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { RecordActivity } from "./activity.ts";
import type { Auth } from "./auth.ts";
import { invalidInput } from "./invalid-input.ts";
import type { Log } from "./log.ts";
import { explain } from "./mcp-refusals.ts";
import type { AnyTool } from "./mcp-tool.ts";
import { tools as allTools } from "./mcp-tools.ts";
import type { OperationContext } from "./operations.ts";
import { Refusal } from "./refusal.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** The owner of the access token, set by the MCP authentication. */
      tokenOwnerId: string;
    }
  }
}

const instructions =
  "Mensal tracks a person's monthly cash flow. Amounts are integer BRL cents (R$ 50,00 = 5000). Periods are YYYY-MM. Every read result carries `today` in America/Sao_Paulo.";

/**
 * `POST /api/mcp`: the MCP server (PRD §8.9, ADR-0004), stateless Streamable
 * HTTP. Every request is authenticated by its access token and gets a server
 * and transport of its own. Anything but POST is 405: there is no session and
 * no server-to-client stream.
 */
export function mcpRouter({
  auth,
  db,
  now,
  record,
  log,
  tools = allTools,
}: {
  auth: Auth;
  db: Database;
  now: () => Date;
  /** Records activity with `"via":"mcp"`. */
  record: RecordActivity;
  log: Log;
  tools?: AnyTool[];
}) {
  const router = Router();
  router.post(
    "/",
    authenticateToken(auth, db),
    express.json(),
    async (req, res, next) => {
      const context: OperationContext = {
        db,
        now,
        record,
        userId: res.locals.tokenOwnerId,
      };
      const server = createServer(tools, context, log);
      // No session id generator: stateless. The SDK's declarations clash
      // with exactOptionalPropertyTypes, hence `as Transport` below.
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport as Transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        next(error);
      }
    }
  );
  router.all("/", (_req, res) => {
    res.set("Allow", "POST").status(405).json({ code: "METHOD_NOT_ALLOWED" });
  });
  return router;
}

/**
 * Lets through only a valid access token (`Authorization: Bearer`) whose
 * owner is approved, checked on every request (PRD §8.9), and puts the owner's
 * id in `res.locals.tokenOwnerId`. The plugin enforces the token's rate limit.
 */
function authenticateToken(auth: Auth, db: Database): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = /^Bearer\s+(\S+)$/i.exec(
        req.headers.authorization ?? ""
      )?.[1];
      if (!key) {
        res.status(401).json({ code: "UNAUTHENTICATED" });
        return;
      }
      const result = await auth.api.verifyApiKey({ body: { key } });
      if (result.error?.code === "RATE_LIMITED") {
        res.status(429).json({ code: "TOO_MANY_REQUESTS" });
        return;
      }
      const ownerId = result.valid ? result.key?.referenceId : undefined;
      const [owner] = ownerId
        ? await db
            .select({ approved: schema.users.approved })
            .from(schema.users)
            .where(eq(schema.users.id, ownerId))
        : [];
      if (!ownerId || !owner) {
        res.status(401).json({ code: "UNAUTHENTICATED" });
        return;
      }
      if (!owner.approved) {
        res.status(403).json({ code: "USER_NOT_APPROVED" });
        return;
      }
      res.locals.tokenOwnerId = ownerId;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** A server offering `tools`, each running as `context`'s user. */
function createServer(tools: AnyTool[], context: OperationContext, log: Log) {
  const server = new Server(
    { name: "mensal", version: "1.0.0" },
    { capabilities: { tools: {} }, instructions }
  );
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      annotations: tool.annotations,
      inputSchema: z.toJSONSchema(tool.input, {
        target: "draft-7",
        io: "input",
      }) as { type: "object" },
      outputSchema: z.toJSONSchema(tool.output, {
        target: "draft-7",
        io: "output",
      }) as { type: "object" },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const tool = byName.get(params.name);
    if (!tool) {
      return refused(new Refusal(404, "TOOL_NOT_FOUND"));
    }
    const input = tool.input.safeParse(params.arguments ?? {});
    if (!input.success) {
      const { code, fields } = invalidInput(input.error);
      return refused(new Refusal(400, code, fields));
    }
    try {
      // Round-tripped through JSON: dates become strings, as in REST.
      const data = JSON.parse(
        JSON.stringify(await tool.run(context, input.data))
      ) as Record<string, unknown>;
      return {
        structuredContent: data,
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    } catch (error) {
      if (error instanceof Refusal) return refused(error);
      // Never described to the agent (PRD §8.6).
      log(
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      );
      return refused(new Refusal(500, "INTERNAL_ERROR"));
    }
  });

  return server;
}

/** An `isError` result carrying the refusal's code, fields and explanation. */
function refused({ code, fields }: Refusal): CallToolResult {
  const message = explain(code, fields);
  return {
    isError: true,
    structuredContent: { code, ...(fields && { fields }), message },
    content: [{ type: "text", text: `${code}: ${message}` }],
  };
}
