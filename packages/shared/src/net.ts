/** Net calories for a day (in − out). Null unless both values were entered. */
export function netCalories(caloriesIn: number | null, caloriesOut: number | null): number | null {
  if (caloriesIn === null || caloriesOut === null) return null;
  return caloriesIn - caloriesOut;
}

/** From `startsOn` on, the body burns `calories` a day at rest, until the next change. */
export interface BaseCaloriesChange {
  startsOn: string;
  calories: number;
}

/** The base burn in effect on `date`: the latest change starting on or before it, else 0. */
export function baseCaloriesOn(changes: readonly BaseCaloriesChange[], date: string): number {
  let found: BaseCaloriesChange | undefined;
  for (const c of changes) {
    if (c.startsOn <= date && (!found || c.startsOn > found.startsOn)) found = c;
  }
  return found?.calories ?? 0;
}

/**
 * A day's total burn and net. The base counts once calories in or active calories are
 * entered, so empty days and days with only a weight stay blank.
 */
export function dayCalories(
  caloriesIn: number | null,
  caloriesActive: number | null,
  base: number,
): { caloriesOut: number | null; net: number | null } {
  const caloriesOut =
    caloriesActive !== null ? caloriesActive + base : caloriesIn !== null && base > 0 ? base : null;
  return { caloriesOut, net: netCalories(caloriesIn, caloriesOut) };
}
