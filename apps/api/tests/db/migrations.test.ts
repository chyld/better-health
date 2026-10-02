import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDb } from "../../src/db/client";

const drizzleDir = join(import.meta.dir, "../../drizzle");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "better-health-migrate-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A database as it was before exercise units: only the first migration applied. */
function databaseAtFirstMigration(path: string) {
  const folder = join(dir, "first");
  mkdirSync(join(folder, "meta"), { recursive: true });
  cpSync(join(drizzleDir, "0000_init.sql"), join(folder, "0000_init.sql"));
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, 1);
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
  const sqlite = new Database(path);
  migrate(drizzle({ client: sqlite }), { migrationsFolder: folder });
  return sqlite;
}

test("exercise units migration keeps existing labels and turns notes into amounts", () => {
  const path = join(dir, "app.db");
  const old = databaseAtFirstMigration(path);
  old.run(
    "insert into users (id, username, password_hash, created_at) values (1, 'alice', 'x', 'x')",
  );
  old.run("insert into exercise_types (id, user_id, name, sort_order) values (1, 1, 'Walking', 0)");
  for (const [id, note] of [
    [1, "3 miles"],
    [2, "2.5"],
    [3, "five sets"],
    [4, ""],
  ] as const) {
    old.run(
      "insert into exercise_entries (id, user_id, date, exercise_type_id, note, created_at) values (?, 1, '2026-10-01', 1, ?, 'x')",
      [id, note],
    );
  }
  old.close();

  const db = openDb(path);
  const sqlite = db.$client;
  expect(sqlite.query("select name, unit from exercise_types").all()).toEqual([
    { name: "Walking", unit: "" },
  ]);
  expect(sqlite.query("select id, amount from exercise_entries order by id").all()).toEqual([
    { id: 1, amount: 3 },
    { id: 2, amount: 2.5 },
    { id: 3, amount: 0 },
    { id: 4, amount: 0 },
  ]);
  const columns = sqlite.query("pragma table_info(exercise_entries)").all() as { name: string }[];
  expect(columns.map((c) => c.name)).not.toContain("note");

  // The same name can now exist with another unit.
  sqlite.run(
    "insert into exercise_types (user_id, name, unit, sort_order) values (1, 'Walking', 'miles', 1)",
  );
  expect(() =>
    sqlite.run(
      "insert into exercise_types (user_id, name, unit, sort_order) values (1, 'walking', 'MILES', 2)",
    ),
  ).toThrow();
  sqlite.close();
});
