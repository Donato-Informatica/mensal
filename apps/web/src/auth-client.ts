import { createAuthClient as createBetterAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

/** Better-Auth's client, talking to the API on the page's own origin. */
export function createAuthClient(fetchImpl: typeof fetch = fetch) {
  return createBetterAuthClient({
    baseURL: window.location.origin,
    fetchOptions: { customFetchImpl: fetchImpl },
    plugins: [
      inferAdditionalFields({
        user: { approved: { type: "boolean", required: true, input: false } },
      }),
    ],
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;
