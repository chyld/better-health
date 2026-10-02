/** Net calories for a day (in − out). Null unless both values were entered. */
export function netCalories(caloriesIn: number | null, caloriesOut: number | null): number | null {
  if (caloriesIn === null || caloriesOut === null) return null;
  return caloriesIn - caloriesOut;
}
