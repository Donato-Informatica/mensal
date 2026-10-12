import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { currentPeriod, periodOfMonth } from "@mensal/shared";
import { redirectFor, type Access } from "./access.ts";
import type { ApiClient } from "./api-client.ts";
import type { AuthClient } from "./auth-client.ts";
import { AwaitingApproval } from "./awaiting-approval.tsx";
import { ForgotPassword } from "./forgot-password.tsx";
import { Month } from "./month.tsx";
import { periodQuery } from "./period-query.ts";
import { recurrencesQuery } from "./recurrence-query.ts";
import { Recurrences } from "./recurrences.tsx";
import { ResetPassword } from "./reset-password.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";
import { SignUp } from "./sign-up.tsx";
import { ErrorScreen, NotFoundScreen } from "./status-screens.tsx";

interface RouterContext {
  authClient: AuthClient;
  api: ApiClient;
  queryClient: QueryClient;
}

const root = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

/** A layout route that only lets in `area` visitors, sending the rest home. */
function guardedArea(id: Access) {
  return createRoute({
    getParentRoute: () => root,
    id,
    beforeLoad: async ({ context: { authClient, queryClient } }) => {
      const session = await queryClient.ensureQueryData(
        sessionQuery(authClient)
      );
      const to = redirectFor(session, id);
      if (to) throw redirect({ to, replace: true });
    },
  });
}

const anonymous = guardedArea("anonymous");
const awaitingApproval = guardedArea("awaiting-approval");
const approved = guardedArea("approved");

/** The monthly screen, on `?mes=YYYY-MM` or the current period without it. */
const month = createRoute({
  getParentRoute: () => approved,
  path: "/",
  validateSearch: (search): { mes?: string | undefined } => ({
    mes:
      typeof search.mes === "string" && periodOfMonth(search.mes)
        ? search.mes
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    period:
      (search.mes === undefined ? undefined : periodOfMonth(search.mes)) ??
      currentPeriod(),
  }),
  loader: ({ context: { api, queryClient }, deps: { period } }) =>
    queryClient.ensureQueryData(periodQuery(api, period)),
  component: function MonthRoute() {
    const { period } = month.useLoaderDeps();
    return <Month period={period} />;
  },
});

/** The recurrences screen: the active ones, or all on `?filtro=todas`. */
const recurrences = createRoute({
  getParentRoute: () => approved,
  path: "/recorrencias",
  validateSearch: (search): { filtro?: "todas" | undefined } => ({
    filtro: search.filtro === "todas" ? "todas" : undefined,
  }),
  loaderDeps: ({ search }) => ({
    status: search.filtro === "todas" ? ("all" as const) : ("active" as const),
  }),
  loader: ({ context: { api, queryClient }, deps: { status } }) =>
    queryClient.ensureQueryData(recurrencesQuery(api, status)),
  component: function RecurrencesRoute() {
    const { status } = recurrences.useLoaderDeps();
    return <Recurrences status={status} />;
  },
});

/**
 * Where an opened reset link lands: with `?token=`, or without one (Better-Auth
 * sends `?error=INVALID_TOKEN`) when the link is invalid or expired.
 */
const resetPassword = createRoute({
  getParentRoute: () => anonymous,
  path: "/redefinir-senha",
  validateSearch: (search): { token?: string | undefined } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: function ResetPasswordRoute() {
    const { token } = resetPassword.useSearch();
    return <ResetPassword token={token} />;
  },
});

const routeTree = root.addChildren([
  anonymous.addChildren([
    createRoute({
      getParentRoute: () => anonymous,
      path: "/entrar",
      component: SignIn,
    }),
    createRoute({
      getParentRoute: () => anonymous,
      path: "/cadastro",
      component: SignUp,
    }),
    createRoute({
      getParentRoute: () => anonymous,
      path: "/esqueci-a-senha",
      component: ForgotPassword,
    }),
    resetPassword,
  ]),
  awaitingApproval.addChildren([
    createRoute({
      getParentRoute: () => awaitingApproval,
      path: "/aguardando-aprovacao",
      component: AwaitingApproval,
    }),
  ]),
  approved.addChildren([month, recurrences]),
]);

export function createAppRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultNotFoundComponent: NotFoundScreen,
    defaultErrorComponent: ErrorScreen,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
