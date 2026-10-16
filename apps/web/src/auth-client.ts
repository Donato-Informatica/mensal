import { createAuthClient as createBetterAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { ColorSchemeSchema, defaultColorScheme } from "@mensal/shared";

/** Better-Auth's client, talking to the API on the page's own origin. */
export function createAuthClient(fetchImpl: typeof fetch = fetch) {
  return createBetterAuthClient({
    baseURL: window.location.origin,
    fetchOptions: { customFetchImpl: fetchImpl },
    plugins: [
      // Mirrors `user.additionalFields` in apps/api/src/auth.ts.
      inferAdditionalFields({
        user: {
          approved: { type: "boolean", required: true, input: false },
          showSummary: {
            type: "boolean",
            required: true,
            defaultValue: true,
            input: true,
          },
          confirmStatusChanges: {
            type: "boolean",
            required: true,
            defaultValue: true,
            input: true,
          },
          // A string the API validates; typed here by the values it allows.
          colorScheme: {
            type: [...ColorSchemeSchema.options],
            required: true,
            defaultValue: defaultColorScheme,
            input: true,
          },
        },
      }),
    ],
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;
