import { Link, useNavigate } from "@tanstack/react-router";
import {
  HeartPulse,
  History,
  LogOut,
  NotebookPen,
  ScrollText,
  ShieldCheck,
  Tags,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/features/auth/queries";
import { useLogout } from "@/features/auth/queries";

const navLink =
  "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-violet-900 transition-colors hover:bg-violet-100";

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-violet-100 bg-white/75 px-3 py-2 backdrop-blur-md sm:px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="brand-gradient grid size-8 place-items-center rounded-xl text-white shadow-md shadow-violet-500/30">
            <HeartPulse className="size-5" aria-hidden="true" />
          </span>
          {/* Just the logo on phones, to leave room for the nav. */}
          <span className="sr-only sm:not-sr-only">
            Better <span className="text-fuchsia-700">Health</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link to="/log" className={navLink} activeProps={{ className: "bg-violet-100" }}>
            <ScrollText className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Log</span>
          </Link>
          <Link to="/notes" className={navLink} activeProps={{ className: "bg-violet-100" }}>
            <NotebookPen className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Notes</span>
          </Link>
          <Link to="/history" className={navLink} activeProps={{ className: "bg-violet-100" }}>
            <History className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">History</span>
          </Link>
          <Link to="/labels" className={navLink} activeProps={{ className: "bg-violet-100" }}>
            <Tags className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Labels</span>
          </Link>
          {user.isAdmin && (
            <Link to="/admin" className={navLink} activeProps={{ className: "bg-violet-100" }}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Admin</span>
            </Link>
          )}
          <Link
            to="/profile"
            aria-label={`Profile, ${user.username}`}
            className="ml-1 flex items-center gap-2 rounded-full p-0.5 text-sm font-semibold text-violet-900 transition-colors hover:bg-violet-100 sm:pr-3"
            activeProps={{ className: "bg-violet-100" }}
          >
            <span
              className="grid size-8 place-items-center rounded-full bg-linear-to-br from-orange-400 to-pink-500 font-bold text-white uppercase"
              aria-hidden="true"
            >
              {user.username.slice(0, 1)}
            </span>
            <span className="hidden sm:inline">{user.username}</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-violet-900 hover:bg-violet-100"
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => navigate({ to: "/login" }) })
            }
          >
            <LogOut aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
