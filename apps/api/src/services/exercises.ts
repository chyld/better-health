import type { DayDetail, ExerciseEntryPatch, Measurement } from "@better-health/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { exerciseEntries, exerciseMeasurements } from "../db/schema";
import { type Clock, systemClock } from "../lib/clock";
import { NotFoundError, ValidationError } from "../lib/errors";
import { getDay } from "./days";
import { requireExerciseType } from "./exercise-types";

function requireActiveType(db: Db, userId: number, id: number) {
  const type = requireExerciseType(db, userId, id);
  if (type.archivedAt) throw new ValidationError(`"${type.name}" is archived`);
  return type;
}

function requireEntry(db: Db, userId: number, date: string, id: number) {
  const entry = db
    .select()
    .from(exerciseEntries)
    .where(
      and(
        eq(exerciseEntries.id, id),
        eq(exerciseEntries.userId, userId),
        eq(exerciseEntries.date, date),
      ),
    )
    .get();
  if (!entry) throw new NotFoundError("Exercise entry not found");
  return entry;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Units are unique per entry; the schemas have already checked that. */
function insertMeasurements(tx: Tx, entryId: number, measurements: Measurement[]) {
  if (measurements.length === 0) return;
  tx.insert(exerciseMeasurements)
    .values(measurements.map((m) => ({ entryId, unit: m.unit, amount: m.amount })))
    .run();
}

export function addExercise(
  db: Db,
  userId: number,
  date: string,
  input: { exerciseTypeId: number; measurements: Measurement[] },
  clock: Clock = systemClock,
): DayDetail {
  requireActiveType(db, userId, input.exerciseTypeId);
  db.transaction((tx) => {
    const { id } = tx
      .insert(exerciseEntries)
      .values({
        userId,
        date,
        exerciseTypeId: input.exerciseTypeId,
        createdAt: clock.now().toISOString(),
      })
      .returning({ id: exerciseEntries.id })
      .get();
    insertMeasurements(tx, id, input.measurements);
  });
  return getDay(db, userId, date);
}

export function updateExercise(
  db: Db,
  userId: number,
  date: string,
  id: number,
  patch: ExerciseEntryPatch,
): DayDetail {
  const entry = requireEntry(db, userId, date, id);
  if (patch.exerciseTypeId !== undefined && patch.exerciseTypeId !== entry.exerciseTypeId) {
    requireActiveType(db, userId, patch.exerciseTypeId);
  }
  db.transaction((tx) => {
    if (patch.exerciseTypeId !== undefined) {
      tx.update(exerciseEntries)
        .set({ exerciseTypeId: patch.exerciseTypeId })
        .where(eq(exerciseEntries.id, id))
        .run();
    }
    if (patch.measurements !== undefined) {
      tx.delete(exerciseMeasurements).where(eq(exerciseMeasurements.entryId, id)).run();
      insertMeasurements(tx, id, patch.measurements);
    }
  });
  return getDay(db, userId, date);
}

export function deleteExercise(db: Db, userId: number, date: string, id: number): DayDetail {
  requireEntry(db, userId, date, id);
  db.delete(exerciseEntries).where(eq(exerciseEntries.id, id)).run();
  return getDay(db, userId, date);
}
