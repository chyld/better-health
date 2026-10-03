import {
  type DayDetail,
  type DayNote,
  type DayPatch,
  type DaySummary,
  datesInMonth,
  type ExerciseEntry,
  type HistoryDay,
  netCalories,
} from "@better-health/shared";
import { and, asc, between, count, desc, eq, isNotNull, or, sum } from "drizzle-orm";
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
  const counts = new Map<string, number>();
  const totals = new Map<string, DaySummary["exerciseTotals"]>();
  for (const row of db
    .select({
      date: exerciseEntries.date,
      exerciseTypeId: exerciseEntries.exerciseTypeId,
      n: count(),
      amount: sum(exerciseEntries.amount).mapWith(Number),
    })
    .from(exerciseEntries)
    .where(and(eq(exerciseEntries.userId, userId), between(exerciseEntries.date, first, last)))
    .groupBy(exerciseEntries.date, exerciseEntries.exerciseTypeId)
    .orderBy(asc(exerciseEntries.exerciseTypeId))
    .all()) {
    counts.set(row.date, (counts.get(row.date) ?? 0) + row.n);
    const list = totals.get(row.date) ?? [];
    list.push({ exerciseTypeId: row.exerciseTypeId, amount: row.amount });
    totals.set(row.date, list);
  }

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
      exerciseTotals: totals.get(date) ?? [],
      hasNote: Boolean(log?.note),
    };
  });
}

const entryColumns = {
  date: exerciseEntries.date,
  id: exerciseEntries.id,
  exerciseTypeId: exerciseEntries.exerciseTypeId,
  name: exerciseTypes.name,
  category: exerciseTypes.category,
  unit: exerciseTypes.unit,
  archivedAt: exerciseTypes.archivedAt,
  amount: exerciseEntries.amount,
  createdAt: exerciseEntries.createdAt,
};

function listEntries(db: Db, userId: number, date: string): ExerciseEntry[] {
  return db
    .select(entryColumns)
    .from(exerciseEntries)
    .innerJoin(exerciseTypes, eq(exerciseTypes.id, exerciseEntries.exerciseTypeId))
    .where(and(eq(exerciseEntries.userId, userId), eq(exerciseEntries.date, date)))
    .orderBy(asc(exerciseEntries.createdAt), asc(exerciseEntries.id))
    .all()
    .map(({ date: _date, archivedAt, ...e }) => ({ ...e, archived: archivedAt !== null }));
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

/** Every day with a note, newest first. */
export function listNotes(db: Db, userId: number): DayNote[] {
  return db
    .select({ date: dailyLogs.date, note: dailyLogs.note })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), isNotNull(dailyLogs.note)))
    .orderBy(desc(dailyLogs.date))
    .all()
    .filter((r): r is DayNote => Boolean(r.note?.trim()));
}

/** Every day with calories in, calories out or weight logged, newest first. */
export function listHistory(db: Db, userId: number): HistoryDay[] {
  return db
    .select({
      date: dailyLogs.date,
      caloriesIn: dailyLogs.caloriesIn,
      caloriesOut: dailyLogs.caloriesOut,
      weightLbs: dailyLogs.weightLbs,
    })
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, userId),
        or(
          isNotNull(dailyLogs.caloriesIn),
          isNotNull(dailyLogs.caloriesOut),
          isNotNull(dailyLogs.weightLbs),
        ),
      ),
    )
    .orderBy(desc(dailyLogs.date))
    .all()
    .map((r) => ({ ...r, net: netCalories(r.caloriesIn, r.caloriesOut) }));
}

/** Every day with anything logged (values, a note or exercises), newest first. */
export function listLog(db: Db, userId: number): DayDetail[] {
  const logs = new Map(
    db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, userId))
      .all()
      .map((row) => [row.date, row]),
  );
  const entries = new Map<string, ExerciseEntry[]>();
  for (const { date, archivedAt, ...e } of db
    .select(entryColumns)
    .from(exerciseEntries)
    .innerJoin(exerciseTypes, eq(exerciseTypes.id, exerciseEntries.exerciseTypeId))
    .where(eq(exerciseEntries.userId, userId))
    .orderBy(asc(exerciseEntries.createdAt), asc(exerciseEntries.id))
    .all()) {
    const list = entries.get(date) ?? [];
    list.push({ ...e, archived: archivedAt !== null });
    entries.set(date, list);
  }

  const dates = [...new Set([...logs.keys(), ...entries.keys()])].sort().reverse();
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
      note: log?.note ?? null,
      exercises: entries.get(date) ?? [],
    };
  });
}
