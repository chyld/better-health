import { createApp } from "./app";
import { openDb } from "./db/client";
import { systemClock } from "./lib/clock";
import { ensureDbDir, loadEnv } from "./lib/env";
import { sweepExpiredSessions } from "./services/sessions";

const env = loadEnv();
ensureDbDir(env.DATABASE_PATH);
const db = openDb(env.DATABASE_PATH);

const swept = sweepExpiredSessions(db, systemClock);
if (swept > 0) console.log(`Removed ${swept} expired session(s).`);

const app = createApp({ db, cookieSecure: env.NODE_ENV === "production" });

console.log(`Listening on http://${env.HOST}:${env.PORT}`);

export default { port: env.PORT, hostname: env.HOST, fetch: app.fetch };
