import {
  HIGHLIGHT_RULES_MAX,
  type HighlightRule,
  type highlightRuleCreateSchema,
} from "@better-health/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "../db/client";
import { highlightRules } from "../db/schema";
import { ConflictError, NotFoundError } from "../lib/errors";
import { requireExerciseType } from "./exercise-types";

/** The user's rules in list order; the first one a day meets colours its cell. */
export function listHighlightRules(db: Db, userId: number): HighlightRule[] {
  return db
    .select({
      id: highlightRules.id,
      metric: highlightRules.metric,
      exerciseTypeId: highlightRules.exerciseTypeId,
      unit: highlightRules.unit,
      operator: highlightRules.operator,
      target: highlightRules.target,
      color: highlightRules.color,
      sortOrder: highlightRules.sortOrder,
    })
    .from(highlightRules)
    .where(eq(highlightRules.userId, userId))
    .orderBy(asc(highlightRules.sortOrder), asc(highlightRules.id))
    .all();
}

/** Adds a rule at the end of the list. */
export function createHighlightRule(
  db: Db,
  userId: number,
  rule: z.output<typeof highlightRuleCreateSchema>,
): HighlightRule {
  // Another user's label is reported as missing.
  if (rule.exerciseTypeId !== null) requireExerciseType(db, userId, rule.exerciseTypeId);
  const { n, next } = db
    .select({
      n: sql<number>`count(*)`,
      next: sql<number>`coalesce(max(${highlightRules.sortOrder}), -1) + 1`,
    })
    .from(highlightRules)
    .where(eq(highlightRules.userId, userId))
    .get() ?? { n: 0, next: 0 };
  if (n >= HIGHLIGHT_RULES_MAX) {
    throw new ConflictError(`At most ${HIGHLIGHT_RULES_MAX} highlight rules`);
  }
  const row = db
    .insert(highlightRules)
    .values({ userId, ...rule, sortOrder: next })
    .returning()
    .get();
  const created = listHighlightRules(db, userId).find((r) => r.id === row.id);
  if (!created) throw new NotFoundError("Highlight rule not found");
  return created;
}

export function deleteHighlightRule(db: Db, userId: number, id: number): HighlightRule[] {
  const deleted = db
    .delete(highlightRules)
    .where(and(eq(highlightRules.id, id), eq(highlightRules.userId, userId)))
    .returning({ id: highlightRules.id })
    .all();
  if (deleted.length === 0) throw new NotFoundError("Highlight rule not found");
  return listHighlightRules(db, userId);
}

/** Puts the given rules first, in the given order; any others keep their relative order after. */
export function reorderHighlightRules(db: Db, userId: number, ids: number[]): HighlightRule[] {
  const all = listHighlightRules(db, userId);
  const known = new Set(all.map((r) => r.id));
  if (ids.some((id) => !known.has(id))) throw new NotFoundError("Highlight rule not found");
  const listed = new Set(ids);
  const order = [...ids, ...all.filter((r) => !listed.has(r.id)).map((r) => r.id)];
  db.transaction((tx) => {
    for (const [sortOrder, id] of order.entries()) {
      tx.update(highlightRules).set({ sortOrder }).where(eq(highlightRules.id, id)).run();
    }
  });
  return listHighlightRules(db, userId);
}
