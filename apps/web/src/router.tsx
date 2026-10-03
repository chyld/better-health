import { isValidIsoDate, isValidIsoMonth, localIsoDate } from "@better-health/shared";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AdminPage } from "@/features/admin/AdminPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { meQuery } from "@/features/auth/queries";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { LabelsPage } from "@/features/labels/LabelsPage";
import { NotesPage } from "@/features/notes/NotesPage";

export interface RouterContext {
  queryClient: QueryClient;
  today: () => string;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQuery)) throw redirect({ to: "/" });
  },
  component: function LoginRoute() {
    const { redirect: to } = loginRoute.useSearch();
    return <LoginPage redirect={to} />;
  },
});

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery);
    if (!user) {
      throw redirect({
        to: "/login",
        search: location.href === "/" ? {} : { redirect: location.href },
      });
    }
    return { user };
  },
  component: function AuthedLayout() {
    const { user } = authedRoute.useRouteContext();
    return (
      <AppShell user={user}>
        <Outlet />
      </AppShell>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    throw redirect({
      to: "/calendar/$month",
      params: { month: context.today().slice(0, 7) },
      search: {},
    });
  },
});

export const calendarRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/calendar/$month",
  validateSearch: (search: Record<string, unknown>): { day?: string } =>
    typeof search.day === "string" && isValidIsoDate(search.day) ? { day: search.day } : {},
  beforeLoad: ({ params, context }) => {
    if (!isValidIsoMonth(params.month)) {
      throw redirect({
        to: "/calendar/$month",
        params: { month: context.today().slice(0, 7) },
        search: {},
      });
    }
  },
  component: CalendarPage,
});

const labelsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/labels",
  component: LabelsPage,
});

const notesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/notes",
  component: NotesPage,
});

const adminRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/admin",
  // Non-admins never see the page; the API refuses them too.
  beforeLoad: ({ context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([indexRoute, calendarRoute, labelsRoute, notesRoute, adminRoute]),
]);

export function createAppRouter(options: {
  queryClient: QueryClient;
  history?: RouterHistory;
  today?: () => string;
}) {
  return createRouter({
    routeTree,
    history: options.history,
    context: {
      queryClient: options.queryClient,
      today: options.today ?? (() => localIsoDate(new Date())),
    },
    defaultPreload: false,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
