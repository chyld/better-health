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

/** A database with only the first `count` migrations applied. */
function databaseAtMigration(path: string, count: number) {
  const folder = join(dir, `first-${count}`);
  mkdirSync(join(folder, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, count);
  for (const { tag } of journal.entries) {
    cpSync(join(drizzleDir, `${tag}.sql`), join(folder, `${tag}.sql`));
  }
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
  const sqlite = new Database(path);
  migrate(drizzle({ client: sqlite }), { migrationsFolder: folder });
  return sqlite;
}

test("exercise units migration keeps existing labels and turns notes into amounts", () => {
  const path = join(dir, "app.db");
  const old = databaseAtMigration(path, 1);
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

  const sqlite = migrateTo(path, 2);
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

/** Applies the first `count` migrations to an existing database. */
function migrateTo(path: string, count: number) {
  const folder = join(dir, `to-${count}`);
  mkdirSync(join(folder, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, count);
  for (const { tag } of journal.entries) {
    cpSync(join(drizzleDir, `${tag}.sql`), join(folder, `${tag}.sql`));
  }
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
  const sqlite = new Database(path);
  migrate(drizzle({ client: sqlite }), { migrationsFolder: folder });
  return sqlite;
}

test("optional measurements migration moves units onto entries and merges labels", () => {
  const path = join(dir, "app.db");
  const old = databaseAtMigration(path, 5);
  old.run("pragma foreign_keys = on");
  for (const [id, name] of [
    [1, "alice"],
    [2, "bob"],
  ] as const) {
    old.run("insert into users (id, username, password_hash, created_at) values (?, ?, 'x', 'x')", [
      id,
      name,
    ]);
  }
  const label = (
    id: number,
    userId: number,
    name: string,
    unit: string,
    category: string,
    archived = false,
  ) =>
    old.run(
      "insert into exercise_types (id, user_id, name, unit, category, sort_order, archived_at) values (?, ?, ?, ?, ?, ?, ?)",
      [id, userId, name, unit, category, id, archived ? "x" : null],
    );
  label(1, 1, "Walking", "miles", "cardio");
  label(2, 1, "walking", "Minutes", "", true);
  label(3, 1, "Pushups", "", "strength");
  label(4, 1, "Yoga", "minutes", "", true);
  label(5, 1, "Yoga", "sessions", "stretch", true);
  label(6, 2, "Walking", "km", "cardio");
  const entry = (id: number, userId: number, typeId: number, amount: number) =>
    old.run(
      "insert into exercise_entries (id, user_id, date, exercise_type_id, amount, created_at) values (?, ?, '2026-10-01', ?, ?, 'x')",
      [id, userId, typeId, amount],
    );
  entry(1, 1, 1, 3);
  entry(2, 1, 2, 45);
  entry(3, 1, 2, 30);
  entry(4, 1, 3, 50);
  entry(5, 1, 3, 0);
  entry(6, 2, 6, 5);
  old.run(
    "insert into highlight_rules (user_id, metric, exercise_type_id, operator, target, color, sort_order) values (1, 'exercise', 1, '>=', 3, 'green', 0), (1, 'weight', null, '<', 200, 'red', 1)",
  );
  old.close();

  const sqlite = openDb(path).$client;
  // "walking (Minutes)" has more entries, so it is kept; it gains the category and becomes
  // active because "Walking (miles)" was. Both archived Yoga labels merge and stay archived.
  expect(
    sqlite
      .query("select id, user_id, name, category, archived_at from exercise_types order by id")
      .all(),
  ).toEqual([
    { id: 2, user_id: 1, name: "walking", category: "cardio", archived_at: null },
    { id: 3, user_id: 1, name: "Pushups", category: "strength", archived_at: null },
    { id: 4, user_id: 1, name: "Yoga", category: "stretch", archived_at: "x" },
    { id: 6, user_id: 2, name: "Walking", category: "cardio", archived_at: null },
  ]);
  expect(
    sqlite.query("select id, exercise_type_id from exercise_entries order by id").all(),
  ).toEqual([
    { id: 1, exercise_type_id: 2 },
    { id: 2, exercise_type_id: 2 },
    { id: 3, exercise_type_id: 2 },
    { id: 4, exercise_type_id: 3 },
    { id: 5, exercise_type_id: 3 },
    { id: 6, exercise_type_id: 6 },
  ]);
  expect(
    sqlite
      .query("select entry_id, unit, amount from exercise_measurements order by entry_id")
      .all(),
  ).toEqual([
    { entry_id: 1, unit: "miles", amount: 3 },
    { entry_id: 2, unit: "minutes", amount: 45 },
    { entry_id: 3, unit: "minutes", amount: 30 },
    { entry_id: 4, unit: "reps", amount: 50 },
    { entry_id: 6, unit: "km", amount: 5 },
  ]);
  expect(
    sqlite.query("select metric, exercise_type_id, unit from highlight_rules order by id").all(),
  ).toEqual([
    { metric: "exercise", exercise_type_id: 2, unit: "miles" },
    { metric: "weight", exercise_type_id: null, unit: null },
  ]);
  const columns = (table: string) =>
    (sqlite.query(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  expect(columns("exercise_types")).not.toContain("unit");
  expect(columns("exercise_entries")).not.toContain("amount");
  // A name is now unique per user, ignoring case.
  expect(() =>
    sqlite.run(
      "insert into exercise_types (user_id, name, category, sort_order) values (1, 'PUSHUPS', '', 9)",
    ),
  ).toThrow();
  sqlite.close();
});
