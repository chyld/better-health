import type { DayDetail, ExerciseEntryCreate, ExerciseEntryPatch } from "@better-health/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { exerciseEntries } from "../db/schema";
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

export function addExercise(
  db: Db,
  userId: number,
  date: string,
  input: ExerciseEntryCreate,
  clock: Clock = systemClock,
): DayDetail {
  requireActiveType(db, userId, input.exerciseTypeId);
  db.insert(exerciseEntries)
    .values({
      userId,
      date,
      exerciseTypeId: input.exerciseTypeId,
      note: input.note,
      createdAt: clock.now().toISOString(),
    })
    .run();
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
  db.update(exerciseEntries)
    .set({
      exerciseTypeId: patch.exerciseTypeId ?? entry.exerciseTypeId,
      note: patch.note ?? entry.note,
    })
    .where(eq(exerciseEntries.id, id))
    .run();
  return getDay(db, userId, date);
}

export function deleteExercise(db: Db, userId: number, date: string, id: number): DayDetail {
  requireEntry(db, userId, date, id);
  db.delete(exerciseEntries).where(eq(exerciseEntries.id, id)).run();
  return getDay(db, userId, date);
}
