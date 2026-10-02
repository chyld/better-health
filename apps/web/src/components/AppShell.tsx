import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/features/auth/queries";
import { useLogout } from "@/features/auth/queries";

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <Link to="/" className="font-semibold">
          Better Health
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/labels">Labels</Link>
          </Button>
          <span className="hidden text-muted-foreground sm:inline">{user.username}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => navigate({ to: "/login" }) })
            }
          >
            Sign out
          </Button>
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
