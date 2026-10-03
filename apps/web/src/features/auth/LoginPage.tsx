import { useNavigate } from "@tanstack/react-router";
import { Dumbbell, Flame, HeartPulse, Scale } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useLogin } from "./queries";

export function LoginPage({ redirect }: { redirect?: string }) {
  const navigate = useNavigate();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => navigate({ to: redirect?.startsWith("/") ? redirect : "/" }) },
    );
  }

  const error =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "Could not sign in"
        : null;

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-6 rounded-3xl bg-white/85 p-6 shadow-2xl shadow-violet-500/15 ring-1 ring-violet-100 backdrop-blur sm:p-8"
        aria-label="Sign in"
      >
        <div className="space-y-4 text-center">
          <span className="brand-gradient mx-auto grid size-16 place-items-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/30 motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
            <HeartPulse className="size-9" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Better <span className="text-fuchsia-700">Health</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Calories, weight and exercise, one happy day at a time.
          </p>
          <div className="flex justify-center gap-2" aria-hidden="true">
            <span className="grid size-8 place-items-center rounded-full bg-orange-100 text-orange-600">
              <Flame className="size-4" />
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-sky-100 text-sky-600">
              <Dumbbell className="size-4" />
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-violet-100 text-violet-600">
              <Scale className="size-4" />
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={login.isPending}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
