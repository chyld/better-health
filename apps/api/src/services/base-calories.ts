import {
  type BaseCaloriesChange,
  type BaseCaloriesSet,
  baseCaloriesOn,
} from "@better-health/shared";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { baseCalories } from "../db/schema";

/** The user's base burn changes, newest first. */
export function listBaseCalories(db: Db, userId: number): BaseCaloriesChange[] {
  return db
    .select({ startsOn: baseCalories.startsOn, calories: baseCalories.calories })
    .from(baseCalories)
    .where(eq(baseCalories.userId, userId))
    .orderBy(desc(baseCalories.startsOn))
    .all();
}

/**
 * Sets the base burn from `startsOn` on, leaving earlier days as they were. A second change on
 * the same day replaces the first, and a change back to what was already in effect is dropped.
 */
export function setBaseCalories(
  db: Db,
  userId: number,
  { calories, startsOn }: BaseCaloriesSet,
): BaseCaloriesChange[] {
  const at = and(eq(baseCalories.userId, userId), eq(baseCalories.startsOn, startsOn));
  const before = listBaseCalories(db, userId).filter((c) => c.startsOn !== startsOn);
  if (baseCaloriesOn(before, startsOn) === calories) {
    db.delete(baseCalories).where(at).run();
  } else {
    db.insert(baseCalories)
      .values({ userId, startsOn, calories })
      .onConflictDoUpdate({
        target: [baseCalories.userId, baseCalories.startsOn],
        set: { calories },
      })
      .run();
  }
  return listBaseCalories(db, userId);
}
