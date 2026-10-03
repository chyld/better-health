import { Hono } from "hono";
import type { AppEnv, Deps } from "../context";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { databaseSnapshot } from "../services/admin";

export function adminRoutes(deps: Deps) {
  return new Hono<AppEnv>().use("*", requireAuth(deps), requireAdmin).get("/backup", async (c) => {
    const bytes = await databaseSnapshot(deps.db);
    const stamp = deps.clock.now().toISOString().slice(0, 19).replace(/:/g, "-");
    return c.body(bytes, 200, {
      "content-type": "application/vnd.sqlite3",
      "content-disposition": `attachment; filename="better-health-${stamp}.db"`,
      "cache-control": "no-store",
    });
  });
}
