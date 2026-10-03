import type { HighlightColor, HighlightMetric, HighlightOperator } from "./highlights";

/** Response shapes shared by the API and the web app. */

export interface DaySummary {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
  exerciseCount: number;
  /** The day's total amount for each exercise label logged on it. */
  exerciseTotals: { exerciseTypeId: number; amount: number }[];
  hasNote: boolean;
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
  unit: string;
  archived: boolean;
  amount: number;
  createdAt: string;
}

export interface DayDetail {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
  note: string | null;
  exercises: ExerciseEntry[];
}

/** A day with at least one of calories in, calories out or weight; for the History page. */
export interface HistoryDay {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
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
  /** Empty only for labels created before units existed. */
  unit: string;
  sortOrder: number;
  archived: boolean;
  lastUsedOn: string | null;
}

/** Colours a calendar cell when the day's value for a metric meets a condition. */
export interface HighlightRule {
  id: number;
  metric: HighlightMetric;
  /** Set only when `metric` is "exercise". */
  exerciseTypeId: number | null;
  operator: HighlightOperator;
  target: number;
  color: HighlightColor;
  sortOrder: number;
}
