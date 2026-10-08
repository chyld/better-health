import {
  CELL_FIELDS_MAX,
  type CellField,
  type CellFieldPatch,
  type cellFieldCreateSchema,
} from "@better-health/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "../db/client";
import { cellFields } from "../db/schema";
import { ConflictError, NotFoundError } from "../lib/errors";
import { requireExerciseType } from "./exercise-types";

/** The user's calendar cell fields in the order cells show them. */
export function listCellFields(db: Db, userId: number): CellField[] {
  return db
    .select({
      id: cellFields.id,
      metric: cellFields.metric,
      exerciseTypeId: cellFields.exerciseTypeId,
      unit: cellFields.unit,
      caption: cellFields.caption,
      color: cellFields.color,
      sortOrder: cellFields.sortOrder,
    })
    .from(cellFields)
    .where(eq(cellFields.userId, userId))
    .orderBy(asc(cellFields.sortOrder), asc(cellFields.id))
    .all();
}

/** Adds a field at the end of the list. */
export function createCellField(
  db: Db,
  userId: number,
  field: z.output<typeof cellFieldCreateSchema>,
): CellField[] {
  // Another user's label is reported as missing.
  if (field.exerciseTypeId !== null) requireExerciseType(db, userId, field.exerciseTypeId);
  const { n, next } = db
    .select({
      n: sql<number>`count(*)`,
      next: sql<number>`coalesce(max(${cellFields.sortOrder}), -1) + 1`,
    })
    .from(cellFields)
    .where(eq(cellFields.userId, userId))
    .get() ?? { n: 0, next: 0 };
  if (n >= CELL_FIELDS_MAX) {
    throw new ConflictError(`At most ${CELL_FIELDS_MAX} values on calendar cells`);
  }
  db.insert(cellFields)
    .values({ userId, ...field, sortOrder: next })
    .run();
  return listCellFields(db, userId);
}

export function updateCellField(
  db: Db,
  userId: number,
  id: number,
  patch: CellFieldPatch,
): CellField[] {
  const updated = db
    .update(cellFields)
    .set(patch)
    .where(and(eq(cellFields.id, id), eq(cellFields.userId, userId)))
    .returning({ id: cellFields.id })
    .all();
  if (updated.length === 0) throw new NotFoundError("Calendar cell value not found");
  return listCellFields(db, userId);
}

export function deleteCellField(db: Db, userId: number, id: number): CellField[] {
  const deleted = db
    .delete(cellFields)
    .where(and(eq(cellFields.id, id), eq(cellFields.userId, userId)))
    .returning({ id: cellFields.id })
    .all();
  if (deleted.length === 0) throw new NotFoundError("Calendar cell value not found");
  return listCellFields(db, userId);
}

/** Puts the given fields first, in the given order; any others keep their relative order after. */
export function reorderCellFields(db: Db, userId: number, ids: number[]): CellField[] {
  const all = listCellFields(db, userId);
  const known = new Set(all.map((f) => f.id));
  if (ids.some((id) => !known.has(id))) throw new NotFoundError("Calendar cell value not found");
  const listed = new Set(ids);
  const order = [...ids, ...all.filter((f) => !listed.has(f.id)).map((f) => f.id)];
  db.transaction((tx) => {
    for (const [sortOrder, id] of order.entries()) {
      tx.update(cellFields).set({ sortOrder }).where(eq(cellFields.id, id)).run();
    }
  });
  return listCellFields(db, userId);
}
