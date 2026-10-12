import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { redirectFor, type Access } from "./access.ts";
import type { AuthClient } from "./auth-client.ts";
import { AwaitingApproval } from "./awaiting-approval.tsx";
import { Home } from "./home.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";
import { SignUp } from "./sign-up.tsx";
import { ErrorScreen, NotFoundScreen } from "./status-screens.tsx";

interface RouterContext {
  authClient: AuthClient;
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
  ]),
  awaitingApproval.addChildren([
    createRoute({
      getParentRoute: () => awaitingApproval,
      path: "/aguardando-aprovacao",
      component: AwaitingApproval,
    }),
  ]),
  approved.addChildren([
    createRoute({
      getParentRoute: () => approved,
      path: "/",
      component: Home,
    }),
  ]),
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
