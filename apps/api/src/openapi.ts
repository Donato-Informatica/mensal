import {
  NewOneOffSchema,
  NewRecurrenceSchema,
  OccurrenceEditSchema,
  OccurrenceSchema,
  PeriodPayloadSchema,
  RecurrenceEditSchema,
  RecurrenceListQuerySchema,
  RecurrenceSchema,
  StatusChangeSchema,
  VirtualOccurrenceSchema,
} from "@mensal/shared";
import { z } from "zod";

type Schema = Record<string, unknown>;

interface Response {
  description: string;
  content?: { "application/json": { schema: Schema } };
}

interface Operation {
  tags: string[];
  summary: string;
  security?: Record<string, string[]>[];
  parameters?: {
    name: string;
    in: "path" | "query";
    required: boolean;
    schema: Schema;
  }[];
  requestBody?: Response & { required: true };
  responses: Record<number, Response>;
}

const jsonSchema = (schema: z.ZodType, io: "input" | "output"): Schema =>
  z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
  }) as Schema;

const body = (schema: z.ZodType) => ({
  required: true as const,
  description: "JSON body",
  content: { "application/json": { schema: jsonSchema(schema, "input") } },
});

const ok = (description: string, schema: Schema): Response => ({
  description,
  content: { "application/json": { schema } },
});

const output = (schema: z.ZodType) => jsonSchema(schema, "output");

const noContent: Response = { description: "Done; no body" };

/** A refusal: `{ code }`, one of the codes this operation can answer with. */
const refusal = (description: string, ...codes: string[]): Response =>
  ok(description, {
    type: "object",
    required: ["code"],
    properties: { code: { enum: codes } },
  });

const invalidInput = ok("The input is invalid; `fields` names each field", {
  type: "object",
  required: ["code", "fields"],
  properties: {
    code: { const: "INVALID_INPUT" },
    fields: { type: "array", items: { type: "string" } },
  },
});

/** What every `/api/v1` operation answers before it runs (PRD §8.2). */
const gate: Record<number, Response> = {
  401: refusal("Not signed in", "UNAUTHENTICATED"),
  403: refusal("Signed in, but not approved yet", "USER_NOT_APPROVED"),
};

const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
} as const;

/** An occurrence as the API answers: persisted, or still virtual (PRD §5.2). */
const anyOccurrence = {
  anyOf: [output(OccurrenceSchema), output(VirtualOccurrenceSchema)],
};

const notFound = (code: string) => refusal("Not found", code);

/** The OpenAPI 3.1 description of the API, served at `/api/openapi.json`. */
export function buildOpenApiSpec() {
  const secured = (operation: Operation): Operation => ({
    ...operation,
    security: [{ cookieAuth: [] }],
    responses: { ...gate, ...operation.responses },
  });

  const paths: Record<string, Record<string, Operation>> = {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Check that the database answers",
        responses: {
          200: ok("The database answers", {
            type: "object",
            required: ["status"],
            properties: { status: { const: "ok" } },
          }),
          503: ok("The database is down or too slow", {
            type: "object",
            required: ["status"],
            properties: { status: { const: "unavailable" } },
          }),
        },
      },
    },
    "/api/v1/me": {
      get: secured({
        tags: ["Account"],
        summary: "Get the signed-in user's id",
        responses: {
          200: ok("The user", {
            type: "object",
            required: ["userId"],
            properties: { userId: { type: "string" } },
          }),
        },
      }),
    },
    "/api/v1/periods/{month}": {
      get: secured({
        tags: ["Periods"],
        summary: "Get a period's occurrences and summary",
        parameters: [
          {
            name: "month",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
          },
        ],
        responses: {
          200: ok("The period", output(PeriodPayloadSchema)),
          400: refusal("The month is not a valid YYYY-MM", "INVALID_PERIOD"),
        },
      }),
    },
    "/api/v1/recurrences": {
      get: secured({
        tags: ["Recurrences"],
        summary: "List recurrences",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: jsonSchema(RecurrenceListQuerySchema.shape.status, "input"),
          },
        ],
        responses: {
          200: ok("The recurrences", {
            type: "array",
            items: output(RecurrenceSchema),
          }),
          400: invalidInput,
        },
      }),
      post: secured({
        tags: ["Recurrences"],
        summary: "Create a recurrence",
        requestBody: body(NewRecurrenceSchema),
        responses: {
          201: ok("The recurrence", output(RecurrenceSchema)),
          400: ok("The input is invalid, or the start period is in the past", {
            oneOf: [
              invalidInput.content!["application/json"].schema,
              refusal("", "START_PERIOD_IN_PAST").content!["application/json"]
                .schema,
            ],
          }),
        },
      }),
    },
    "/api/v1/recurrences/{id}": {
      get: secured({
        tags: ["Recurrences"],
        summary: "Get a recurrence",
        parameters: [idParameter],
        responses: {
          200: ok("The recurrence", output(RecurrenceSchema)),
          404: notFound("RECURRENCE_NOT_FOUND"),
        },
      }),
      patch: secured({
        tags: ["Recurrences"],
        summary: "Edit a recurrence",
        parameters: [idParameter],
        requestBody: body(RecurrenceEditSchema),
        responses: {
          200: ok("The recurrence", output(RecurrenceSchema)),
          400: ok(
            "The input is invalid, or the end period precedes the start",
            {
              oneOf: [
                invalidInput.content!["application/json"].schema,
                refusal("", "END_PERIOD_BEFORE_START").content![
                  "application/json"
                ].schema,
              ],
            }
          ),
          404: notFound("RECURRENCE_NOT_FOUND"),
        },
      }),
      delete: secured({
        tags: ["Recurrences"],
        summary: "Delete a recurrence that has no persisted occurrences",
        parameters: [idParameter],
        responses: {
          204: noContent,
          404: notFound("RECURRENCE_NOT_FOUND"),
          409: refusal(
            "It already has persisted occurrences",
            "RECURRENCE_HAS_OCCURRENCES"
          ),
        },
      }),
    },
    "/api/v1/occurrences": {
      post: secured({
        tags: ["Occurrences"],
        summary: "Create a one-off occurrence",
        requestBody: body(NewOneOffSchema),
        responses: {
          201: ok("The occurrence", output(OccurrenceSchema)),
          400: invalidInput,
        },
      }),
    },
    "/api/v1/occurrences/{id}": {
      patch: secured({
        tags: ["Occurrences"],
        summary: "Edit an occurrence; a virtual one is materialized first",
        parameters: [idParameter],
        requestBody: body(OccurrenceEditSchema),
        responses: {
          200: ok("The occurrence", anyOccurrence),
          400: ok("The input is invalid, or the edit is refused", {
            oneOf: [
              invalidInput.content!["application/json"].schema,
              refusal(
                "",
                "DUE_DATE_OUTSIDE_PERIOD",
                "OCCURRENCE_NOT_SETTLED",
                "AMOUNT_REQUIRED_TO_SETTLE"
              ).content!["application/json"].schema,
            ],
          }),
          404: notFound("OCCURRENCE_NOT_FOUND"),
        },
      }),
      delete: secured({
        tags: ["Occurrences"],
        summary: "Delete a one-off occurrence",
        parameters: [idParameter],
        responses: {
          204: noContent,
          404: notFound("OCCURRENCE_NOT_FOUND"),
          409: refusal(
            "It belongs to a recurrence; skip it instead",
            "ONLY_ONE_OFF_DELETABLE"
          ),
        },
      }),
    },
    "/api/v1/occurrences/{id}/status": {
      patch: secured({
        tags: ["Occurrences"],
        summary: "Change an occurrence's status; a virtual one is materialized",
        parameters: [idParameter],
        requestBody: body(StatusChangeSchema),
        responses: {
          200: ok("The occurrence", anyOccurrence),
          400: ok("The input is invalid, or settling needs an amount", {
            oneOf: [
              invalidInput.content!["application/json"].schema,
              refusal("", "AMOUNT_REQUIRED_TO_SETTLE").content![
                "application/json"
              ].schema,
            ],
          }),
          404: notFound("OCCURRENCE_NOT_FOUND"),
        },
      }),
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Mensal API",
      version: "1.0.0",
      description:
        "Forecast and settle a person's monthly cash flow. Amounts are BRL cents; a period is the 1st of a month. Sign in through the `/api/auth` routes first: the session cookie authenticates every `/api/v1` call.",
    },
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
        },
      },
    },
  };
}
