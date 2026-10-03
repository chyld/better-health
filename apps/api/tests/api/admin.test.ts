import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setAdmin } from "../../src/services/users";
import { createTestApp } from "../helpers/app";

/** Opens downloaded bytes as a database and runs `fn` on it. */
function withDownloadedDb<T>(bytes: ArrayBuffer, fn: (db: Database) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "bh-admin-test-"));
  try {
    const path = join(dir, "download.db");
    writeFileSync(path, new Uint8Array(bytes));
    const db = new Database(path, { readonly: true });
    try {
      return fn(db);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("an admin downloads a complete copy of the database", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const bob = await t.signedInUser("bob");
  setAdmin(t.db, "alice", true);
  await t.json("/api/days/2026-10-02", "PATCH", { caloriesIn: 1850, note: "bob's" }, bob.cookie);

  const res = await t.request("/api/admin/backup", { cookie });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/vnd.sqlite3");
  expect(res.headers.get("content-disposition")).toBe(
    'attachment; filename="better-health-2026-10-02T12-00-00.db"',
  );
  expect(res.headers.get("cache-control")).toBe("no-store");

  withDownloadedDb(await res.arrayBuffer(), (db) => {
    expect(db.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    const users = db.query("SELECT username FROM users ORDER BY id").all();
    expect(users).toEqual([{ username: "alice" }, { username: "bob" }]);
    expect(db.query("SELECT calories_in, note FROM daily_logs").all()).toEqual([
      { calories_in: 1850, note: "bob's" },
    ]);
  });
});

test("anyone who is not an admin is refused", async () => {
  const t = createTestApp();
  expect((await t.request("/api/admin/backup")).status).toBe(401);
  const { cookie } = await t.signedInUser("alice");
  const res = await t.request("/api/admin/backup", { cookie });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: { code: "forbidden", message: "Admins only" } });
});

test("revoking admin takes effect on the next request", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  setAdmin(t.db, "alice", true);
  expect((await t.request("/api/admin/backup", { cookie })).status).toBe(200);
  setAdmin(t.db, "alice", false);
  expect((await t.request("/api/admin/backup", { cookie })).status).toBe(403);
});
