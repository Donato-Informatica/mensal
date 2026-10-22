import {
  queryOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  rootRouteId,
  useNavigate,
  useRouteContext,
  type HistoryState,
} from "@tanstack/react-router";
import type { ColorScheme, OccurrenceView } from "@mensal/shared";
import { unwrap, type AuthResult } from "./api-error.ts";
import type { AuthClient } from "./auth-client.ts";
import { forgetTrendSettings } from "./trend-settings.ts";
import { rememberViewedMonth } from "./viewed-month.ts";

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

/**
 * The signed-in user's session, for screens whose route guard lets in only
 * signed-in users (and has already loaded it).
 */
export function useSession() {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const session = useSuspenseQuery(sessionQuery(authClient)).data;
  if (!session) throw new Error("useSession needs a signed-in user");
  return session;
}

/** The preferences (PRD §3.5), kept on the account's Better-Auth user (ADR-0002). */
export interface Preferences {
  showSummary: boolean;
  confirmStatusChanges: boolean;
  colorScheme: ColorScheme;
  occurrenceView: OccurrenceView;
}

/** A preference, by name. */
export type Preference = keyof Preferences;

/** Why the newest save of a preference failed; `dismiss` forgets it. */
export interface SaveFailure {
  error: unknown;
  dismiss: () => void;
}

/** One save of a preference: the value sent, numbered in the order started. */
interface Save<P extends Preference> {
  to: Preferences[P];
  id: number;
}

/**
 * What every screen's saves of one preference share: the newest one's number,
 * and the value the account holds as far as the app has heard.
 */
interface Saves<P extends Preference> {
  newest: number;
  saved: Preferences[P];
}

type SavesByPreference = { [P in Preference]?: Saves<P> };

const savesByClient = new WeakMap<QueryClient, SavesByPreference>();

function savesOf<P extends Preference>(
  queryClient: QueryClient,
  preference: P,
  value: Preferences[P]
): Saves<P> {
  const byPreference: SavesByPreference = savesByClient.get(queryClient) ?? {};
  savesByClient.set(queryClient, byPreference);
  const saves: Saves<P> = byPreference[preference] ?? {
    newest: 0,
    saved: value,
  };
  // TypeScript cannot tie a generic key to its own entry's type on a write.
  byPreference[preference] = saves as SavesByPreference[P];
  return saves;
}

/**
 * A preference of the signed-in user and a setter that saves it to the
 * account. The change shows at once. Quick changes can be answered in any
 * order: only the newest one decides, so a failure of one that a newer change
 * replaced is neither rolled back nor reported. The third item is the newest
 * save's failure, for screens that report it.
 */
export function usePreference<P extends Preference>(preference: P) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const { queryKey } = sessionQuery(authClient);
  const mutationKey = ["preference", preference];
  const preferences: Preferences = useSession().user;
  const value = preferences[preference];
  const saves = savesOf(queryClient, preference, value);

  function show(to: Preferences[P]) {
    queryClient.setQueryData(
      queryKey,
      (session) =>
        session && { ...session, user: { ...session.user, [preference]: to } }
    );
  }

  const save = useMutation({
    mutationKey,
    mutationFn: async ({ to }: Save<P>) =>
      unwrap(await authClient.updateUser({ [preference]: to })),
    onMutate: async ({ to }) => {
      // A refetch already on its way would land the old value over this one.
      await queryClient.cancelQueries({ queryKey });
      show(to);
    },
    // The cache already shows the newest value: writing the response over it
    // could undo a quicker, later change.
    onSuccess: (_data, { to }) => {
      saves.saved = to;
    },
    // A newer save decides what shows; with none, back to what the account holds.
    onError: (_error, { id }) => {
      if (id === saves.newest) show(saves.saved);
    },
  });

  function setValue(to: Preferences[P]) {
    // With no save on its way, what shows is what the account holds.
    if (queryClient.isMutating({ mutationKey }) === 0) saves.saved = value;
    saves.newest += 1;
    save.mutate({ to, id: saves.newest });
  }

  const failure: SaveFailure | undefined =
    save.isError && save.variables.id === saves.newest
      ? { error: save.error, dismiss: save.reset }
      : undefined;
  return [value, setValue, failure] as const;
}

declare module "@tanstack/history" {
  interface HistoryState {
    /** Set on the way to the sign-in screen after the account was deleted. */
    accountDeleted?: boolean;
  }
}

/**
 * A mutation that changes who is signed in, then goes to `to`, carrying
 * `state`, so the route guards place the user afresh.
 */
export function useSessionChange<Input = void>(
  change: (authClient: AuthClient, input: Input) => Promise<AuthResult>,
  to: "/" | "/entrar",
  { state, mutationKey }: { state?: HistoryState; mutationKey?: string[] } = {}
) {
  const { authClient } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    ...(mutationKey && { mutationKey }),
    mutationFn: async (input: Input) => unwrap(await change(authClient, input)),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: sessionKey });
      rememberViewedMonth(queryClient, undefined);
      forgetTrendSettings(queryClient);
      await navigate({ to, ...(state && { state }) });
    },
  });
}
