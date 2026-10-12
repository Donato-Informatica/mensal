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
