import {
  compareExerciseTotals,
  type DayDetail,
  type DayNote,
  type DayPatch,
  type DaySummary,
  datesInMonth,
  type ExerciseEntry,
  type HistoryDay,
  type Measurement,
  netCalories,
} from "@better-health/shared";
import { and, asc, between, count, desc, eq, isNotNull, or, type SQL, sum } from "drizzle-orm";
import type { Db } from "../db/client";
import { dailyLogs, exerciseEntries, exerciseMeasurements, exerciseTypes } from "../db/schema";
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
  const inMonth = and(
    eq(exerciseEntries.userId, userId),
    between(exerciseEntries.date, first, last),
  );
  const counts = new Map<string, number>();
  const totals = new Map<string, DaySummary["exerciseTotals"]>();
  const addTotal = (date: string, total: DaySummary["exerciseTotals"][number]) => {
    totals.set(date, [...(totals.get(date) ?? []), total]);
  };
  // How many times each label was logged: the unit-less total.
  for (const row of db
    .select({
      date: exerciseEntries.date,
      exerciseTypeId: exerciseEntries.exerciseTypeId,
      n: count(),
    })
    .from(exerciseEntries)
    .where(inMonth)
    .groupBy(exerciseEntries.date, exerciseEntries.exerciseTypeId)
    .all()) {
    counts.set(row.date, (counts.get(row.date) ?? 0) + row.n);
    addTotal(row.date, { exerciseTypeId: row.exerciseTypeId, unit: null, amount: row.n });
  }
  // And the sum of each unit measured with it.
  for (const row of db
    .select({
      date: exerciseEntries.date,
      exerciseTypeId: exerciseEntries.exerciseTypeId,
      unit: exerciseMeasurements.unit,
      amount: sum(exerciseMeasurements.amount).mapWith(Number),
    })
    .from(exerciseMeasurements)
    .innerJoin(exerciseEntries, eq(exerciseEntries.id, exerciseMeasurements.entryId))
    .where(inMonth)
    .groupBy(exerciseEntries.date, exerciseEntries.exerciseTypeId, exerciseMeasurements.unit)
    .all()) {
    const { date, ...total } = row;
    addTotal(date, total);
  }
  for (const list of totals.values()) list.sort(compareExerciseTotals);

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

/** The user's entries matching `where`, oldest first, with their measurements. */
function selectEntries(db: Db, where: SQL | undefined): (ExerciseEntry & { date: string })[] {
  const rows = db
    .select({
      date: exerciseEntries.date,
      id: exerciseEntries.id,
      exerciseTypeId: exerciseEntries.exerciseTypeId,
      name: exerciseTypes.name,
      category: exerciseTypes.category,
      archivedAt: exerciseTypes.archivedAt,
      createdAt: exerciseEntries.createdAt,
    })
    .from(exerciseEntries)
    .innerJoin(exerciseTypes, eq(exerciseTypes.id, exerciseEntries.exerciseTypeId))
    .where(where)
    .orderBy(asc(exerciseEntries.createdAt), asc(exerciseEntries.id))
    .all();
  const measurements = new Map<number, Measurement[]>();
  for (const { entryId, ...m } of db
    .select({
      entryId: exerciseMeasurements.entryId,
      unit: exerciseMeasurements.unit,
      amount: exerciseMeasurements.amount,
    })
    .from(exerciseMeasurements)
    .innerJoin(exerciseEntries, eq(exerciseEntries.id, exerciseMeasurements.entryId))
    .where(where)
    .orderBy(asc(exerciseMeasurements.id))
    .all()) {
    measurements.set(entryId, [...(measurements.get(entryId) ?? []), m]);
  }
  return rows.map(({ archivedAt, ...e }) => ({
    ...e,
    archived: archivedAt !== null,
    measurements: measurements.get(e.id) ?? [],
  }));
}

function listEntries(db: Db, userId: number, date: string): ExerciseEntry[] {
  return selectEntries(
    db,
    and(eq(exerciseEntries.userId, userId), eq(exerciseEntries.date, date)),
  ).map(({ date: _date, ...e }) => e);
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
  for (const { date, ...e } of selectEntries(db, eq(exerciseEntries.userId, userId))) {
    const list = entries.get(date) ?? [];
    list.push(e);
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
