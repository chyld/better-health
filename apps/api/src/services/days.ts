import {
  type DayDetail,
  type DayPatch,
  type DaySummary,
  datesInMonth,
  type ExerciseEntry,
  netCalories,
} from "@better-health/shared";
import { and, asc, between, count, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { dailyLogs, exerciseEntries, exerciseTypes } from "../db/schema";
import { type Clock, systemClock } from "../lib/clock";

type LogRow = typeof dailyLogs.$inferSelect;

export function getMonth(db: Db, userId: number, month: string): DaySummary[] {
  const dates = datesInMonth(month);
  const first = dates[0] ?? "";
  const last = dates.at(-1) ?? "";

  const logs = new Map(
    db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), between(dailyLogs.date, first, last)))
      .all()
      .map((row) => [row.date, row]),
  );
  const counts = new Map(
    db
      .select({ date: exerciseEntries.date, n: count() })
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, userId), between(exerciseEntries.date, first, last)))
      .groupBy(exerciseEntries.date)
      .all()
      .map((row) => [row.date, row.n]),
  );

  return dates.map((date) => {
    const log = logs.get(date);
    const caloriesIn = log?.caloriesIn ?? null;
    const caloriesOut = log?.caloriesOut ?? null;
    return {
      date,
      caloriesIn,
      caloriesOut,
      net: netCalories(caloriesIn, caloriesOut),
      weightLbs: log?.weightLbs ?? null,
      exerciseCount: counts.get(date) ?? 0,
      hasNote: Boolean(log?.note),
    };
  });
}

function listEntries(db: Db, userId: number, date: string): ExerciseEntry[] {
  return db
    .select({
      id: exerciseEntries.id,
      exerciseTypeId: exerciseEntries.exerciseTypeId,
      name: exerciseTypes.name,
      unit: exerciseTypes.unit,
      archivedAt: exerciseTypes.archivedAt,
      amount: exerciseEntries.amount,
      createdAt: exerciseEntries.createdAt,
    })
    .from(exerciseEntries)
    .innerJoin(exerciseTypes, eq(exerciseTypes.id, exerciseEntries.exerciseTypeId))
    .where(and(eq(exerciseEntries.userId, userId), eq(exerciseEntries.date, date)))
    .orderBy(asc(exerciseEntries.createdAt), asc(exerciseEntries.id))
    .all()
    .map(({ archivedAt, ...e }) => ({ ...e, archived: archivedAt !== null }));
}

function findLog(db: Db, userId: number, date: string): LogRow | undefined {
  return db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .get();
}

export function getDay(db: Db, userId: number, date: string): DayDetail {
  const log = findLog(db, userId, date);
  const caloriesIn = log?.caloriesIn ?? null;
  const caloriesOut = log?.caloriesOut ?? null;
  return {
    date,
    caloriesIn,
    caloriesOut,
    net: netCalories(caloriesIn, caloriesOut),
    weightLbs: log?.weightLbs ?? null,
    note: log?.note ?? null,
    exercises: listEntries(db, userId, date),
  };
}

/** Applies a partial update; a day left with no values is removed. */
export function patchDay(
  db: Db,
  userId: number,
  date: string,
  patch: DayPatch,
  clock: Clock = systemClock,
): DayDetail {
  const current = findLog(db, userId, date);
  const next = {
    caloriesIn: current?.caloriesIn ?? null,
    caloriesOut: current?.caloriesOut ?? null,
    weightLbs: current?.weightLbs ?? null,
    note: current?.note ?? null,
  };
  if (patch.caloriesIn !== undefined) next.caloriesIn = patch.caloriesIn;
  if (patch.caloriesOut !== undefined) next.caloriesOut = patch.caloriesOut;
  if (patch.weightLbs !== undefined) next.weightLbs = patch.weightLbs;
  if (patch.note !== undefined) next.note = patch.note?.trim() ? patch.note : null;

  const where = and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date));
  const empty = Object.values(next).every((v) => v === null);
  if (empty) {
    db.delete(dailyLogs).where(where).run();
  } else {
    db.insert(dailyLogs)
      .values({ userId, date, ...next, updatedAt: clock.now().toISOString() })
      .onConflictDoUpdate({
        target: [dailyLogs.userId, dailyLogs.date],
        set: { ...next, updatedAt: clock.now().toISOString() },
      })
      .run();
  }
  return getDay(db, userId, date);
}
