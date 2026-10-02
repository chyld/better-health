/** Calendar-date helpers on "YYYY-MM-DD" / "YYYY-MM" strings. No time zones involved. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function isValidIsoMonth(value: string): boolean {
  const m = ISO_MONTH.exec(value);
  if (!m) return false;
  const [year, month] = [Number(m[1]), Number(m[2])];
  return year >= 1900 && month >= 1 && month <= 12;
}

export function parseMonth(value: string): { year: number; month: number } {
  if (!isValidIsoMonth(value)) throw new Error(`Invalid month: ${value}`);
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}

export function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Every date in the month, in order. */
export function datesInMonth(value: string): string[] {
  const { year, month } = parseMonth(value);
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => formatDate(year, month, i + 1));
}

export function shiftMonth(value: string, delta: number): string {
  const { year, month } = parseMonth(value);
  const index = year * 12 + (month - 1) + delta;
  return formatMonth(Math.floor(index / 12), (index % 12) + 1);
}

/** The local calendar date of an instant. */
export function localIsoDate(date: Date): string {
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** The date `n` days after `date` (negative goes back). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
