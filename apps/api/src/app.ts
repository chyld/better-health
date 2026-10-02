import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Deps } from "./context";
import type { Db } from "./db/client";
import { type Clock, systemClock } from "./lib/clock";
import { AppError } from "./lib/errors";
import { FailureLimiter } from "./lib/rate-limit";
import { authRoutes } from "./routes/auth";
import { dataRoutes } from "./routes/data";
import { testSupportRoutes } from "./routes/test-support";

export interface AppOptions {
  db: Db;
  clock?: Clock;
  loginLimiter?: FailureLimiter;
  cookieSecure?: boolean;
  /** Mounts /api/test/reset. Only ever true when NODE_ENV=test. */
  testSupport?: boolean;
}

export function createApp(options: AppOptions) {
  const clock = options.clock ?? systemClock;
  const deps: Deps = {
    db: options.db,
    clock,
    loginLimiter: options.loginLimiter ?? new FailureLimiter(clock),
    cookieSecure: options.cookieSecure ?? true,
  };

  const app = new Hono<AppEnv>()
    .basePath("/api")
    .use(csrf())
    .get("/health", (c) => c.json({ status: "ok" }, 200))
    .route("/auth", authRoutes(deps))
    .route("/", dataRoutes(deps));

  if (options.testSupport) app.route("/test", testSupportRoutes(deps));

  app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status);
    }
    if (err instanceof HTTPException) {
      const code = err.status === 403 ? "forbidden" : "bad_request";
      const message = err.message || (err.status === 403 ? "Forbidden" : "Bad request");
      return c.json({ error: { code, message } }, err.status);
    }
    console.error(err);
    return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
