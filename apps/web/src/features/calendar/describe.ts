import type { DaySummary } from "@better-health/shared";

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function longDate(date: string): string {
  return LONG_DATE.format(new Date(`${date}T00:00:00Z`));
}

/** What a screen reader announces for a calendar cell. */
export function describeDay(day: DaySummary, { today = false } = {}): string {
  const parts = [longDate(day.date)];
  if (today) parts.push("today");
  if (day.caloriesIn !== null) parts.push(`in ${day.caloriesIn}`);
  if (day.caloriesOut !== null) parts.push(`out ${day.caloriesOut}`);
  if (day.net !== null) parts.push(`net ${day.net < 0 ? "minus " : ""}${Math.abs(day.net)}`);
  if (day.weightLbs !== null) parts.push(`weight ${day.weightLbs.toFixed(1)} pounds`);
  if (day.exerciseCount > 0) {
    parts.push(`${day.exerciseCount} exercise${day.exerciseCount === 1 ? "" : "s"}`);
  }
  if (day.hasNote) parts.push("has a note");
  return parts.join(", ");
}
