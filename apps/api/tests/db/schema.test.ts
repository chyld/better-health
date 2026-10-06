import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { Db } from "../../src/db/client";
import {
  dailyLogs,
  exerciseEntries,
  exerciseMeasurements,
  exerciseTypes,
  sessions,
  users,
} from "../../src/db/schema";
import { createTestDb } from "../helpers/db";
import {
  makeDay,
  makeExercise,
  makeExerciseType,
  makeMeasurement,
  makeUser,
} from "../helpers/factories";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("users", () => {
  test("usernames are unique regardless of case", () => {
    makeUser(db, { username: "Chyld" });
    expect(() => makeUser(db, { username: "chyld" })).toThrow();
  });
});

describe("daily_logs", () => {
  test("allows one row per user per date", () => {
    const user = makeUser(db);
    makeDay(db, user.id, { date: "2026-10-02" });
    expect(() => makeDay(db, user.id, { date: "2026-10-02" })).toThrow();
  });

  test("two users can log the same date", () => {
    const a = makeUser(db);
    const b = makeUser(db);
    makeDay(db, a.id, { date: "2026-10-02" });
    expect(() => makeDay(db, b.id, { date: "2026-10-02" })).not.toThrow();
  });

  test("all value columns are optional", () => {
    const user = makeUser(db);
    const day = makeDay(db, user.id);
    expect(day.caloriesIn).toBeNull();
    expect(day.caloriesOut).toBeNull();
    expect(day.weightLbs).toBeNull();
    expect(day.note).toBeNull();
  });

  test("rejects a user that does not exist", () => {
    expect(() => makeDay(db, 999)).toThrow();
  });
});

describe("exercise_types", () => {
  test("names are unique per user regardless of case", () => {
    const user = makeUser(db);
    makeExerciseType(db, user.id, { name: "Running" });
    expect(() => makeExerciseType(db, user.id, { name: "running" })).toThrow();
  });

  test("different users can share a name", () => {
    const a = makeUser(db);
    const b = makeUser(db);
    makeExerciseType(db, a.id, { name: "Running" });
    expect(() => makeExerciseType(db, b.id, { name: "Running" })).not.toThrow();
  });
});

describe("exercise_entries", () => {
  test("measurements store a decimal amount, one per unit, and go with their entry", () => {
    const user = makeUser(db);
    const type = makeExerciseType(db, user.id);
    const entry = makeExercise(db, user.id, type.id);
    expect(makeMeasurement(db, entry.id, "miles", 3.25).amount).toBe(3.25);
    expect(() => makeMeasurement(db, entry.id, "miles", 1)).toThrow();
    makeMeasurement(db, entry.id, "minutes", 30);
    db.delete(exerciseEntries).where(eq(exerciseEntries.id, entry.id)).run();
    expect(db.select().from(exerciseMeasurements).all()).toEqual([]);
  });

  test("rejects an exercise type that does not exist", () => {
    const user = makeUser(db);
    expect(() => makeExercise(db, user.id, 999)).toThrow();
  });
});

describe("deleting a user", () => {
  test("cascades to all of their data", () => {
    const user = makeUser(db);
    const type = makeExerciseType(db, user.id);
    makeDay(db, user.id);
    makeExercise(db, user.id, type.id);
    db.insert(sessions)
      .values({ tokenHash: "h", userId: user.id, expiresAt: "x", createdAt: "x" })
      .run();

    db.delete(users).where(eq(users.id, user.id)).run();

    expect(db.select().from(dailyLogs).all()).toHaveLength(0);
    expect(db.select().from(exerciseTypes).all()).toHaveLength(0);
    expect(db.select().from(exerciseEntries).all()).toHaveLength(0);
    expect(db.select().from(sessions).all()).toHaveLength(0);
  });

  test("leaves other users' data alone", () => {
    const a = makeUser(db);
    const b = makeUser(db);
    makeDay(db, a.id);
    makeDay(db, b.id);
    db.delete(users).where(eq(users.id, a.id)).run();
    const rows = db.select().from(dailyLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(b.id);
  });
});
