import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { type AppEnv, type Deps, SESSION_COOKIE } from "../context";
import { validate } from "../lib/validate";
import { clearSessionCookie, requireAuth, setSessionCookie } from "../middleware/auth";
import { createSession, deleteSession } from "../services/sessions";
import { verifyCredentials } from "../services/users";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export function authRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .post("/login", validate("json", loginSchema), async (c) => {
      const { username, password } = c.req.valid("json");
      const key = username.toLowerCase();
      if (deps.loginLimiter.isBlocked(key)) {
        return c.json(
          { error: { code: "rate_limited", message: "Too many attempts. Try again in a minute." } },
          429,
        );
      }
      const user = await verifyCredentials(deps.db, username, password);
      if (!user) {
        deps.loginLimiter.recordFailure(key);
        return c.json(
          { error: { code: "invalid_credentials", message: "Invalid username or password" } },
          401,
        );
      }
      deps.loginLimiter.reset(key);
      const session = createSession(deps.db, user.id, deps.clock);
      setSessionCookie(c, deps, session.token, session.expiresAt);
      return c.json({ user: { id: user.id, username: user.username, isAdmin: user.isAdmin } }, 200);
    })
    .post("/logout", (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) deleteSession(deps.db, token);
      clearSessionCookie(c, deps);
      return c.body(null, 204);
    })
    .get("/me", requireAuth(deps), (c) => {
      const user = c.get("user");
      return c.json({ user: { id: user.id, username: user.username, isAdmin: user.isAdmin } }, 200);
    });
}
