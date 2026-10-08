import { join } from "node:path";
import { Hono } from "hono";
import { createApp } from "./app";
import { openDb } from "./db/client";
import { shiftedClock, systemClock } from "./lib/clock";
import { ensureDbDir, loadEnv } from "./lib/env";
import { sweepExpiredSessions } from "./services/sessions";
import { staticRoutes } from "./static";

const env = loadEnv();
ensureDbDir(env.DATABASE_PATH);
const db = openDb(env.DATABASE_PATH);
const clock = env.NODE_ENV === "test" && env.TEST_NOW ? shiftedClock(env.TEST_NOW) : systemClock;

const swept = sweepExpiredSessions(db, clock);
if (swept > 0) console.log(`Removed ${swept} expired session(s).`);

const api = createApp({
  db,
  clock,
  cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  testSupport: env.NODE_ENV === "test",
});
const distDir = join(import.meta.dir, "../../web/dist");
const server = new Hono()
  .route("/", api)
  // Unknown API paths stay JSON 404s instead of falling through to the web app.
  .all("/api/*", (c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404))
  .route("/", staticRoutes(distDir));

console.log(`Listening on http://${env.HOST}:${env.PORT}`);

export default { port: env.PORT, hostname: env.HOST, fetch: server.fetch };
