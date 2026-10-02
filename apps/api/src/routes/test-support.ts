import { Hono } from "hono";
import type { AppEnv, Deps } from "../context";
import { dailyLogs, exerciseEntries, exerciseTypes, sessions, users } from "../db/schema";
import { createUser } from "../services/users";

export const E2E_USERS = ["alice", "bob"] as const;
export const E2E_PASSWORD = "password123";

/** Only mounted when NODE_ENV=test: wipes the database and seeds the e2e users. */
export function testSupportRoutes(deps: Deps) {
  return new Hono<AppEnv>().post("/reset", async (c) => {
    deps.db.transaction((tx) => {
      for (const table of [exerciseEntries, exerciseTypes, dailyLogs, sessions, users]) {
        tx.delete(table).run();
      }
    });
    deps.loginLimiter.clear();
    for (const username of E2E_USERS) {
      await createUser(deps.db, { username, password: E2E_PASSWORD }, deps.clock);
    }
    return c.body(null, 204);
  });
}
