import type { Db } from "../../src/db/client";
import {
  dailyLogs,
  exerciseEntries,
  exerciseMeasurements,
  exerciseTypes,
  users,
} from "../../src/db/schema";

let seq = 0;
const next = () => ++seq;
const NOW = "2026-10-02T12:00:00.000Z";

export function makeUser(db: Db, overrides: Partial<typeof users.$inferInsert> = {}) {
  return db
    .insert(users)
    .values({
      username: `user${next()}`,
      passwordHash: "not-a-real-hash",
      createdAt: NOW,
      ...overrides,
    })
    .returning()
    .get();
}

export function makeDay(
  db: Db,
  userId: number,
  overrides: Partial<typeof dailyLogs.$inferInsert> = {},
) {
  return db
    .insert(dailyLogs)
    .values({ userId, date: "2026-10-02", updatedAt: NOW, ...overrides })
    .returning()
    .get();
}

export function makeExerciseType(
  db: Db,
  userId: number,
  overrides: Partial<typeof exerciseTypes.$inferInsert> = {},
) {
  const n = next();
  return db
    .insert(exerciseTypes)
    .values({ userId, name: `exercise${n}`, sortOrder: n, ...overrides })
    .returning()
    .get();
}

export function makeExercise(
  db: Db,
  userId: number,
  exerciseTypeId: number,
  overrides: Partial<typeof exerciseEntries.$inferInsert> = {},
) {
  return db
    .insert(exerciseEntries)
    .values({ userId, exerciseTypeId, date: "2026-10-02", createdAt: NOW, ...overrides })
    .returning()
    .get();
}

export function makeMeasurement(db: Db, entryId: number, unit: string, amount: number) {
  return db.insert(exerciseMeasurements).values({ entryId, unit, amount }).returning().get();
}
