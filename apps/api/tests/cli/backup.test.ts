import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../src/db/client";
import { backupDatabase, hasPendingMigrations } from "../../src/ops/backup";
import { makeDay, makeUser } from "../helpers/factories";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "better-health-backup-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("backupDatabase", () => {
  test("does nothing when there is no database yet", () => {
    expect(backupDatabase(join(dir, "missing.db"), join(dir, "backups"))).toBeNull();
  });

  test("copies a live WAL database, including uncheckpointed writes", () => {
    const dbPath = join(dir, "live.db");
    const db = openDb(dbPath);
    const user = makeUser(db, { username: "alice" });
    makeDay(db, user.id, { caloriesIn: 1850 });

    const target = backupDatabase(dbPath, join(dir, "backups"), {
      now: new Date("2026-10-02T12:00:00.000Z"),
    });
    expect(target).toEndWith("better-health-2026-10-02T12-00-00-000Z.db");

    const copy = new Database(target ?? "", { readonly: true });
    expect(copy.query("select calories_in from daily_logs").get()).toEqual({ calories_in: 1850 });
    copy.close();
    db.$client.close();
  });

  test("keeps only the newest backups", () => {
    const dbPath = join(dir, "live.db");
    openDb(dbPath).$client.close();
    const backups = join(dir, "backups");
    for (let day = 1; day <= 5; day++) {
      backupDatabase(dbPath, backups, { keep: 3, now: new Date(Date.UTC(2026, 9, day)) });
    }
    expect(readdirSync(backups).sort()).toEqual([
      "better-health-2026-10-03T00-00-00-000Z.db",
      "better-health-2026-10-04T00-00-00-000Z.db",
      "better-health-2026-10-05T00-00-00-000Z.db",
    ]);
  });
});

describe("hasPendingMigrations", () => {
  test("false when there is no database yet", () => {
    expect(hasPendingMigrations(join(dir, "missing.db"))).toBe(false);
  });

  test("false once every migration is applied, true when one is missing", () => {
    const dbPath = join(dir, "live.db");
    const db = openDb(dbPath);
    expect(hasPendingMigrations(dbPath)).toBe(false);
    db.$client.run(
      "DELETE FROM __drizzle_migrations WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations)",
    );
    expect(hasPendingMigrations(dbPath)).toBe(true);
    db.$client.close();
  });

  test("true for a database that predates migration tracking", () => {
    const dbPath = join(dir, "old.db");
    new Database(dbPath).close();
    expect(hasPendingMigrations(dbPath)).toBe(true);
  });
});
