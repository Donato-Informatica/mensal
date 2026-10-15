import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  rootRouteId,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { unwrap, type AuthResult } from "./api-error.ts";
import type { AuthClient } from "./auth-client.ts";

const sessionKey = ["session"];

/** The signed-in user's session, or null when signed out. */
export function sessionQuery(authClient: AuthClient) {
  return queryOptions({
    queryKey: sessionKey,
    queryFn: async () => unwrap(await authClient.getSession()),
    // A failure shows the error screen, which offers its own retry.
    retry: false,
  });
}

/** The session, for screens behind a route guard (which has already loaded it). */
export function useSession() {
  const { authClient } = useRouteContext({ from: rootRouteId });
  return useSuspenseQuery(sessionQuery(authClient)).data;
}

/** A preference (PRD §3.5), kept on the account's Better-Auth user (ADR-0002). */
export type Preference = "showSummary" | "confirmStatusChanges";

/**
 * A preference of the signed-in user and a setter that saves it to the
 * account. The change shows at once; a failed save restores the old value.
 * The third item is the save itself, for screens that report its failure.
 */
export function usePreference(preference: Preference) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(authClient);
  const value = useSession()?.user[preference] ?? true;

  function patch(to: boolean) {
    queryClient.setQueryData(
      queryKey,
      (session) =>
        session && { ...session, user: { ...session.user, [preference]: to } }
    );
  }

  const save = useMutation({
    mutationFn: async (to: boolean) =>
      unwrap(await authClient.updateUser({ [preference]: to })),
    onMutate: async (to) => {
      // A refetch already on its way would land the old value over this one.
      await queryClient.cancelQueries({ queryKey });
      const from = queryClient.getQueryData(queryKey)?.user[preference];
      patch(to);
      return { from };
    },
    // On success the cache already holds the new value: writing the response
    // over it could undo a quicker, later toggle.
    onError: (_error, _to, context) => {
      if (context?.from !== undefined) patch(context.from);
    },
  });
  return [value, save.mutate, save] as const;
}

/**
 * A mutation that changes who is signed in, then goes to `to` so the route
 * guards place the user afresh.
 */
export function useSessionChange<Input = void>(
  change: (authClient: AuthClient, input: Input) => Promise<AuthResult>,
  to: "/" | "/entrar"
) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: Input) => unwrap(await change(authClient, input)),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: sessionKey });
      await navigate({ to });
    },
  });
}
