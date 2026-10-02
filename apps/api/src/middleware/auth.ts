import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { type AppEnv, type Deps, SESSION_COOKIE } from "../context";
import { validateSession } from "../services/sessions";

export function setSessionCookie(c: Context, deps: Deps, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: deps.cookieSecure,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context, deps: Deps) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: deps.cookieSecure });
}

export function requireAuth(deps: Deps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? validateSession(deps.db, token, deps.clock) : null;
    if (!token || !session) {
      if (token) clearSessionCookie(c, deps);
      return c.json({ error: { code: "unauthorized", message: "Not signed in" } }, 401);
    }
    if (session.renewedUntil) setSessionCookie(c, deps, token, session.renewedUntil);
    c.set("user", session.user);
    await next();
  });
}
