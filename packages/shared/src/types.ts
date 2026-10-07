import type { HighlightColor, HighlightMetric, HighlightOperator } from "./highlights";

/** Response shapes shared by the API and the web app. */

export interface DaySummary {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
  steps: number | null;
  distanceMiles: number | null;
  exerciseCount: number;
  /**
   * For each label logged on the day: how many times (unit null), and the total of each unit
   * measured, e.g. Running ×2, Running 5 miles.
   */
  exerciseTotals: ExerciseTotal[];
  hasNote: boolean;
}

export interface ExerciseTotal {
  exerciseTypeId: number;
  /** null counts the label's entries; otherwise the sum of that unit's measurements. */
  unit: string | null;
  amount: number;
}

export interface MonthResponse {
  month: string;
  days: DaySummary[];
}

export interface ExerciseEntry {
  id: number;
  exerciseTypeId: number;
  name: string;
  /** Empty for labels created before categories existed. */
  category: string;
  archived: boolean;
  /** Optional: an entry with none just records that the exercise was done. */
  measurements: Measurement[];
  createdAt: string;
}

/** How much of an exercise, such as 3 miles or 30 minutes. */
export interface Measurement {
  /** Lowercase. */
  unit: string;
  amount: number;
}

export interface DayDetail {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
  steps: number | null;
  distanceMiles: number | null;
  note: string | null;
  exercises: ExerciseEntry[];
}

/** A day with at least one of calories in or out, weight, steps or distance; for History. */
export interface HistoryDay {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
  steps: number | null;
  distanceMiles: number | null;
}

export interface DayNote {
  date: string;
  note: string;
}

export interface ExerciseType {
  id: number;
  name: string;
  /** Empty only for labels created before categories existed. */
  category: string;
  sortOrder: number;
  archived: boolean;
  lastUsedOn: string | null;
  /** Units measured with this label so far, most recently used first. */
  units: string[];
}

/** Colours a calendar cell when the day's value for a metric meets a condition. */
export interface HighlightRule {
  id: number;
  metric: HighlightMetric;
  /** Set only when `metric` is "exercise". */
  exerciseTypeId: number | null;
  /** For exercise rules: the unit whose total is compared, or null to count entries. */
  unit: string | null;
  operator: HighlightOperator;
  target: number;
  color: HighlightColor;
  sortOrder: number;
}
