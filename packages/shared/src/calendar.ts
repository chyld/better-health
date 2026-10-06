import { daysInMonth, formatDate, parseMonth } from "./dates";
import type { ExerciseTotal } from "./types";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Sunday-first weeks for a month; days outside the month are null. */
export function calendarWeeks(month: string): (string | null)[][] {
  const { year, month: m } = parseMonth(month);
  const leading = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const total = daysInMonth(year, m);
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => formatDate(year, m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

const MINUS = "−";

/** 1850 → "1,850"; net values get an explicit sign. */
export function formatNumber(n: number, { signed = false } = {}): string {
  const body = Math.abs(n).toLocaleString("en-US");
  if (n < 0) return `${MINUS}${body}`;
  return signed && n > 0 ? `+${body}` : body;
}

/** Short form for small cells: 950 → "950", 1850 → "1.9k", 12000 → "12k". */
export function formatCompact(n: number, { signed = false } = {}): string {
  const abs = Math.abs(n);
  let body: string;
  if (abs < 1000) body = String(abs);
  else {
    const k = Math.round(abs / 100) / 10;
    body = `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  if (n < 0) return `${MINUS}${body}`;
  return signed && n > 0 ? `+${body}` : body;
}

export function formatWeight(lbs: number): string {
  return lbs.toFixed(1);
}

/** 3 → "3", 3.5 → "3.5", 1234.25 → "1,234.25". */
export function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "3 miles". */
export function measurementText(m: { unit: string; amount: number }): string {
  return `${formatAmount(m.amount)} ${m.unit}`;
}

/** "Walking – 3 miles, 45 minutes", or just "Walking" with nothing measured. */
export function entryText(entry: {
  name: string;
  measurements: readonly { unit: string; amount: number }[];
}): string {
  return entry.measurements.length
    ? `${entry.name} – ${entry.measurements.map(measurementText).join(", ")}`
    : entry.name;
}

/** Day totals order: by label, the count (unit null) first, then units alphabetically. */
export function compareExerciseTotals(a: ExerciseTotal, b: ExerciseTotal): number {
  if (a.exerciseTypeId !== b.exerciseTypeId) return a.exerciseTypeId - b.exerciseTypeId;
  if (a.unit === null || b.unit === null) return a.unit === null ? -1 : 1;
  return a.unit.localeCompare(b.unit);
}
