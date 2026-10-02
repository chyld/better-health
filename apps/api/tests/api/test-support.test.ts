import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { fixedClock } from "../../src/lib/clock";
import { listUsers, verifyCredentials } from "../../src/services/users";
import { createTestDb } from "../helpers/db";
import { makeDay, makeUser } from "../helpers/factories";

const post = (app: ReturnType<typeof createApp>) =>
  app.request("/api/test/reset", { method: "POST", headers: { origin: "http://localhost" } });

describe("POST /api/test/reset", () => {
  test("does not exist unless test support is enabled", async () => {
    const app = createApp({ db: createTestDb() });
    expect((await post(app)).status).toBe(404);
  });

  test("wipes all data and seeds alice and bob", async () => {
    const db = createTestDb();
    const old = makeUser(db, { username: "old" });
    makeDay(db, old.id);
    const app = createApp({ db, clock: fixedClock("2026-10-02T12:00:00Z"), testSupport: true });

    expect((await post(app)).status).toBe(204);
    expect(listUsers(db).map((u) => u.username)).toEqual(["alice", "bob"]);
    expect(await verifyCredentials(db, "alice", "password123")).not.toBeNull();
    expect(db.query.dailyLogs.findMany().sync()).toEqual([]);
  });
});
