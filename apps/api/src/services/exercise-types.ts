import { type ExerciseType, type ExerciseTypePatch, labelText } from "@better-health/shared";
import { and, asc, count, eq, max, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { exerciseEntries, exerciseTypes } from "../db/schema";
import { type Clock, systemClock } from "../lib/clock";
import { ConflictError, NotFoundError } from "../lib/errors";

type Row = typeof exerciseTypes.$inferSelect;

/** Another label with the same name and unit, ignoring case. */
function pairTaken(
  db: Db,
  userId: number,
  name: string,
  unit: string,
  exceptId?: number,
): Row | undefined {
  const row = db
    .select()
    .from(exerciseTypes)
    .where(
      and(
        eq(exerciseTypes.userId, userId),
        eq(sql`lower(${exerciseTypes.name})`, name.toLowerCase()),
        eq(sql`lower(${exerciseTypes.unit})`, unit.toLowerCase()),
      ),
    )
    .get();
  return row && row.id !== exceptId ? row : undefined;
}

function conflict(existing: Row): ConflictError {
  return new ConflictError(
    existing.archivedAt
      ? `"${labelText(existing)}" already exists but is archived; unarchive it instead`
      : `"${labelText(existing)}" already exists`,
  );
}

/** Finds one of the user's labels; another user's id is treated as missing. */
export function requireExerciseType(db: Db, userId: number, id: number): Row {
  const row = db
    .select()
    .from(exerciseTypes)
    .where(and(eq(exerciseTypes.id, id), eq(exerciseTypes.userId, userId)))
    .get();
  if (!row) throw new NotFoundError("Exercise label not found");
  return row;
}

export function listExerciseTypes(
  db: Db,
  userId: number,
  { includeArchived = false } = {},
): ExerciseType[] {
  const lastUsed = db
    .select({
      typeId: exerciseEntries.exerciseTypeId,
      lastUsedOn: max(exerciseEntries.date).as("last_used_on"),
    })
    .from(exerciseEntries)
    .where(eq(exerciseEntries.userId, userId))
    .groupBy(exerciseEntries.exerciseTypeId)
    .as("last_used");

  return db
    .select({
      id: exerciseTypes.id,
      name: exerciseTypes.name,
      category: exerciseTypes.category,
      unit: exerciseTypes.unit,
      sortOrder: exerciseTypes.sortOrder,
      archivedAt: exerciseTypes.archivedAt,
      lastUsedOn: lastUsed.lastUsedOn,
    })
    .from(exerciseTypes)
    .leftJoin(lastUsed, eq(lastUsed.typeId, exerciseTypes.id))
    .where(eq(exerciseTypes.userId, userId))
    .orderBy(asc(exerciseTypes.sortOrder), asc(exerciseTypes.id))
    .all()
    .filter((r) => includeArchived || r.archivedAt === null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      sortOrder: r.sortOrder,
      archived: r.archivedAt !== null,
      lastUsedOn: r.lastUsedOn ?? null,
    }));
}

function toType(db: Db, userId: number, id: number): ExerciseType {
  const found = listExerciseTypes(db, userId, { includeArchived: true }).find((t) => t.id === id);
  if (!found) throw new NotFoundError("Exercise label not found");
  return found;
}

export function createExerciseType(
  db: Db,
  userId: number,
  { name, category, unit }: { name: string; category: string; unit: string },
): ExerciseType {
  const existing = pairTaken(db, userId, name, unit);
  if (existing) throw conflict(existing);
  const { next } = db
    .select({ next: sql<number>`coalesce(max(${exerciseTypes.sortOrder}), -1) + 1` })
    .from(exerciseTypes)
    .where(eq(exerciseTypes.userId, userId))
    .get() ?? { next: 0 };
  const row = db
    .insert(exerciseTypes)
    .values({ userId, name, category, unit, sortOrder: next })
    .returning()
    .get();
  return toType(db, userId, row.id);
}

export function updateExerciseType(
  db: Db,
  userId: number,
  id: number,
  patch: ExerciseTypePatch,
  clock: Clock = systemClock,
): ExerciseType {
  const row = requireExerciseType(db, userId, id);
  const changes: Partial<Row> = {};
  const name = patch.name ?? row.name;
  const unit = patch.unit ?? row.unit;
  if (name !== row.name || unit !== row.unit) {
    const existing = pairTaken(db, userId, name, unit, id);
    if (existing) throw conflict(existing);
    changes.name = name;
    changes.unit = unit;
  }
  if (patch.category !== undefined && patch.category !== row.category) {
    changes.category = patch.category;
  }
  if (patch.archived !== undefined && patch.archived !== (row.archivedAt !== null)) {
    changes.archivedAt = patch.archived ? clock.now().toISOString() : null;
  }
  if (Object.keys(changes).length > 0) {
    db.update(exerciseTypes).set(changes).where(eq(exerciseTypes.id, id)).run();
  }
  return toType(db, userId, id);
}

/** Puts the given labels first, in the given order; any others keep their relative order after. */
export function reorderExerciseTypes(db: Db, userId: number, ids: number[]): ExerciseType[] {
  const all = listExerciseTypes(db, userId, { includeArchived: true });
  const known = new Set(all.map((t) => t.id));
  if (ids.some((id) => !known.has(id))) throw new NotFoundError("Exercise label not found");
  const listed = new Set(ids);
  const order = [...ids, ...all.filter((t) => !listed.has(t.id)).map((t) => t.id)];
  db.transaction((tx) => {
    for (const [sortOrder, id] of order.entries()) {
      tx.update(exerciseTypes).set({ sortOrder }).where(eq(exerciseTypes.id, id)).run();
    }
  });
  return listExerciseTypes(db, userId, { includeArchived: true });
}

/** For the CLI: every label, archived included, with how many exercises are logged with it. */
export function listExerciseTypesWithCounts(
  db: Db,
  userId: number,
): (ExerciseType & { entryCount: number })[] {
  const counts = new Map(
    db
      .select({ typeId: exerciseEntries.exerciseTypeId, n: count() })
      .from(exerciseEntries)
      .where(eq(exerciseEntries.userId, userId))
      .groupBy(exerciseEntries.exerciseTypeId)
      .all()
      .map((r) => [r.typeId, r.n]),
  );
  return listExerciseTypes(db, userId, { includeArchived: true }).map((t) => ({
    ...t,
    entryCount: counts.get(t.id) ?? 0,
  }));
}

/**
 * Permanently deletes a label and every exercise logged with it. Only the CLI calls this;
 * the web app can archive a label but never delete one.
 */
export function deleteExerciseType(db: Db, userId: number, id: number): void {
  requireExerciseType(db, userId, id);
  // Logged exercises go with it (ON DELETE CASCADE).
  db.delete(exerciseTypes)
    .where(and(eq(exerciseTypes.id, id), eq(exerciseTypes.userId, userId)))
    .run();
}
