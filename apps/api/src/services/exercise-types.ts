import type { ExerciseType, ExerciseTypePatch } from "@better-health/shared";
import { and, asc, eq, max, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { exerciseEntries, exerciseTypes } from "../db/schema";
import { type Clock, systemClock } from "../lib/clock";
import { ConflictError, NotFoundError } from "../lib/errors";

type Row = typeof exerciseTypes.$inferSelect;

function nameTaken(db: Db, userId: number, name: string, exceptId?: number): Row | undefined {
  const row = db
    .select()
    .from(exerciseTypes)
    .where(
      and(
        eq(exerciseTypes.userId, userId),
        eq(sql`lower(${exerciseTypes.name})`, name.toLowerCase()),
      ),
    )
    .get();
  return row && row.id !== exceptId ? row : undefined;
}

function conflict(existing: Row): ConflictError {
  return new ConflictError(
    existing.archivedAt
      ? `"${existing.name}" already exists but is archived; unarchive it instead`
      : `"${existing.name}" already exists`,
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

export function createExerciseType(db: Db, userId: number, name: string): ExerciseType {
  const existing = nameTaken(db, userId, name);
  if (existing) throw conflict(existing);
  const { next } = db
    .select({ next: sql<number>`coalesce(max(${exerciseTypes.sortOrder}), -1) + 1` })
    .from(exerciseTypes)
    .where(eq(exerciseTypes.userId, userId))
    .get() ?? { next: 0 };
  const row = db.insert(exerciseTypes).values({ userId, name, sortOrder: next }).returning().get();
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
  if (patch.name !== undefined && patch.name !== row.name) {
    const existing = nameTaken(db, userId, patch.name, id);
    if (existing) throw conflict(existing);
    changes.name = patch.name;
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
