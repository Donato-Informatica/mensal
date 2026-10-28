import {
  AccessTokenSchema,
  CalendarLinkPayloadSchema,
  CreatedAccessTokenSchema,
  MAX_SUMMARY_PERIODS,
  NewAccessTokenSchema,
  NewCalendarLinkSchema,
  NewOneOffSchema,
  NewRecurrenceSchema,
  OccurrenceEditSchema,
  OccurrenceSchema,
  PeriodPayloadSchema,
  RecurrenceEditSchema,
  RecurrenceListQuerySchema,
  RecurrenceSchema,
  StatusChangeSchema,
  SummariesPayloadSchema,
  VirtualOccurrenceSchema,
} from "@mensal/shared";
import { z } from "zod";

type Schema = Record<string, unknown>;

/**
 * A response; its body, if any, by media type (the data archive's is a ZIP,
 * the calendar feed's is iCalendar).
 */
interface Response {
  description: string;
  headers?: Record<string, { description: string; schema: Schema }>;
  content?: Partial<
    Record<
      "application/json" | "application/zip" | "text/calendar",
      { schema: Schema }
    >
  >;
}

/** A response with a JSON body, whose schema another response can reuse. */
type JsonResponse = Response & {
  content: { "application/json": { schema: Schema } };
};

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
  requestBody?: JsonResponse & { required: true };
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

const ok = (description: string, schema: Schema): JsonResponse => ({
  description,
  content: { "application/json": { schema } },
});

const output = (schema: z.ZodType) => jsonSchema(schema, "output");

const noContent: Response = { description: "Done; no body" };

/** A refusal: `{ code }`, one of the codes this operation can answer with. */
const refusal = (description: string, ...codes: string[]): JsonResponse =>
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

/** A 'YYYY-MM' month parameter. */
function monthParameter(name: string, where: "path" | "query") {
  return {
    name,
    in: where,
    required: true,
    schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
  } as const;
}

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
    "/api/v1/access-tokens": {
      get: secured({
        tags: ["Access tokens"],
        summary: "List the user's access tokens, never their secrets",
        responses: {
          200: ok("The access tokens", {
            type: "array",
            items: output(AccessTokenSchema),
          }),
        },
      }),
      post: secured({
        tags: ["Access tokens"],
        summary:
          "Create an access token; its secret is returned only in this response",
        requestBody: body(NewAccessTokenSchema),
        responses: {
          201: ok(
            "The access token and its secret",
            output(CreatedAccessTokenSchema)
          ),
          400: ok("The input is invalid, or the current password is wrong", {
            oneOf: [
              invalidInput.content["application/json"].schema,
              refusal("", "INVALID_PASSWORD").content["application/json"]
                .schema,
            ],
          }),
          429: refusal(
            "Too many wrong passwords in a minute",
            "TOO_MANY_ATTEMPTS"
          ),
        },
      }),
    },
    "/api/v1/access-tokens/{id}": {
      delete: secured({
        tags: ["Access tokens"],
        summary: "Revoke (delete) one of the user's access tokens",
        parameters: [idParameter],
        responses: {
          204: noContent,
          404: notFound("ACCESS_TOKEN_NOT_FOUND"),
        },
      }),
    },
    "/api/v1/calendar-link": {
      get: secured({
        tags: ["Calendar link"],
        summary:
          "Get the user's calendar link (the secret, read-only address of their calendar feed), or null",
        responses: {
          200: ok("The calendar link", output(CalendarLinkPayloadSchema)),
        },
      }),
      post: secured({
        tags: ["Calendar link"],
        summary:
          "Generate a new calendar link, replacing the current one, which stops working at once",
        requestBody: body(NewCalendarLinkSchema),
        responses: {
          201: ok("The new calendar link", output(CalendarLinkPayloadSchema)),
          400: ok("The input is invalid, or the current password is wrong", {
            oneOf: [
              invalidInput.content["application/json"].schema,
              refusal("", "INVALID_PASSWORD").content["application/json"]
                .schema,
            ],
          }),
          429: refusal(
            "Too many wrong passwords in a minute",
            "TOO_MANY_ATTEMPTS"
          ),
        },
      }),
      delete: secured({
        tags: ["Calendar link"],
        summary: "Deactivate the calendar link; done also when there is none",
        responses: { 204: noContent },
      }),
    },
    "/api/calendar.ics": {
      get: {
        tags: ["Calendar link"],
        summary:
          "The calendar a calendar link serves, for a calendar app to subscribe to. No session: the key is the only credential. Read-only",
        parameters: [
          {
            name: "key",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description:
              "The calendar, named Mensal, sent with `Cache-Control: no-store`",
            content: {
              "text/calendar": {
                schema: { type: "string", contentMediaType: "text/calendar" },
              },
            },
          },
          403: refusal("The link's owner is not approved", "USER_NOT_APPROVED"),
          404: {
            description:
              "No such link: the key is missing, unknown, replaced or deactivated. No body",
          },
        },
      },
    },
    "/api/v1/data": {
      get: secured({
        tags: ["Account"],
        summary:
          "Download everything the user entered: a ZIP of perfil.csv, recorrencias.csv and ocorrencias.csv (pt-BR CSV: BOM, `;`, CRLF). Read-only",
        responses: {
          200: {
            description: "The archive, named after today in America/Sao_Paulo",
            headers: {
              "Content-Disposition": {
                description:
                  'attachment; filename="mensal-dados-YYYY-MM-DD.zip"',
                schema: { type: "string" },
              },
            },
            content: {
              "application/zip": {
                schema: { type: "string", contentMediaType: "application/zip" },
              },
            },
          },
        },
      }),
    },
    "/api/v1/periods/{month}": {
      get: secured({
        tags: ["Periods"],
        summary: "Get a period's occurrences and summary",
        parameters: [monthParameter("month", "path")],
        responses: {
          200: ok("The period", output(PeriodPayloadSchema)),
          400: refusal("The month is not a valid YYYY-MM", "INVALID_PERIOD"),
        },
      }),
    },
    "/api/v1/summaries": {
      get: secured({
        tags: ["Summaries"],
        summary: `Get the summary of each period of a range of up to ${MAX_SUMMARY_PERIODS}`,
        parameters: [
          monthParameter("from", "query"),
          monthParameter("to", "query"),
        ],
        responses: {
          200: ok(
            "Each period's summary, ascending",
            output(SummariesPayloadSchema)
          ),
          400: refusal(
            `A month is not a valid YYYY-MM, or \`from\` is after \`to\` or more than ${MAX_SUMMARY_PERIODS} periods before it`,
            "INVALID_PERIOD",
            "INVALID_PERIOD_RANGE"
          ),
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
              invalidInput.content["application/json"].schema,
              refusal("", "START_PERIOD_IN_PAST").content["application/json"]
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
                invalidInput.content["application/json"].schema,
                refusal("", "END_PERIOD_BEFORE_START").content[
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
              invalidInput.content["application/json"].schema,
              refusal(
                "",
                "DUE_DATE_OUTSIDE_PERIOD",
                "OCCURRENCE_NOT_SETTLED",
                "AMOUNT_REQUIRED_TO_SETTLE"
              ).content["application/json"].schema,
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
              invalidInput.content["application/json"].schema,
              refusal("", "AMOUNT_REQUIRED_TO_SETTLE").content[
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
          name: "mensal.session_token",
        },
      },
    },
  };
}
