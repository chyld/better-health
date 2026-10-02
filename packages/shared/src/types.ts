/** Response shapes shared by the API and the web app. */

export interface DaySummary {
  date: string;
  caloriesIn: number | null;
  caloriesOut: number | null;
  net: number | null;
  weightLbs: number | null;
  exerciseCount: number;
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
  archived: boolean;
  note: string;
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

export interface ExerciseType {
  id: number;
  name: string;
  sortOrder: number;
  archived: boolean;
  lastUsedOn: string | null;
}
