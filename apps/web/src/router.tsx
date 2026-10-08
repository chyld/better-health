import { isoDateIn, isValidIsoDate, isValidIsoMonth } from "@better-health/shared";
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
import { HistoryPage, METRIC_IDS, type MetricId } from "@/features/history/HistoryPage";
import { LabelsPage } from "@/features/labels/LabelsPage";
import { LogPage } from "@/features/log/LogPage";
import { NotesPage } from "@/features/notes/NotesPage";
import { ProfilePage } from "@/features/profile/ProfilePage";

export interface RouterContext {
  queryClient: QueryClient;
  now: () => Date;
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
    return {
      user,
      /** Today in the user's time zone, which decides which days can still be changed. */
      today: () => {
        const zone = context.queryClient.getQueryData(meQuery.queryKey)?.timeZone ?? user.timeZone;
        return isoDateIn(context.now(), zone);
      },
    };
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

const logRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/log",
  component: LogPage,
});

const profileRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/profile",
  component: ProfilePage,
});

const historyRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/history",
  validateSearch: (search: Record<string, unknown>): { metric?: MetricId } =>
    METRIC_IDS.includes(search.metric as MetricId) ? { metric: search.metric as MetricId } : {},
  component: HistoryPage,
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
  authedRoute.addChildren([
    indexRoute,
    calendarRoute,
    labelsRoute,
    notesRoute,
    logRoute,
    historyRoute,
    profileRoute,
    adminRoute,
  ]),
]);

export function createAppRouter(options: {
  queryClient: QueryClient;
  history?: RouterHistory;
  now?: () => Date;
}) {
  return createRouter({
    routeTree,
    history: options.history,
    context: {
      queryClient: options.queryClient,
      now: options.now ?? (() => new Date()),
    },
    defaultPreload: false,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
