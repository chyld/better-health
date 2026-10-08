import { z } from "zod";
import { highlightValue } from "./highlights";
import { exerciseUnitSchema } from "./schemas";
import type { CellField, DaySummary } from "./types";

/**
 * What a calendar cell can show: a day's values, how many exercises were logged in all, or, for
 * one label, how many times it was logged (unit null) or the total of one unit.
 */
export const CELL_METRICS = [
  "in",
  "active",
  "base",
  "out",
  "net",
  "weight",
  "steps",
  "distance",
  "exercises",
  "exercise",
] as const;
export type CellMetric = (typeof CELL_METRICS)[number];

export const CELL_FIELDS_MAX = 20;
/** Room for "Walk" or "Steps" beside a value in a ~47px phone cell. */
export const CELL_CAPTION_MAX = 6;

export const cellCaptionSchema = z
  .string()
  .trim()
  .min(1, "Caption is required")
  .max(CELL_CAPTION_MAX, `Caption must be at most ${CELL_CAPTION_MAX} characters`);

export const cellFieldCreateSchema = z
  .strictObject({
    metric: z.enum(CELL_METRICS),
    exerciseTypeId: z.number().int().positive().nullable(),
    /** Label fields only: the unit to total, or null to count how many times. */
    unit: exerciseUnitSchema.nullable().default(null),
    caption: cellCaptionSchema,
  })
  .refine((f) => (f.metric === "exercise") === (f.exerciseTypeId !== null), {
    message: "Pick an exercise label for an exercise field, and only then",
    path: ["exerciseTypeId"],
  })
  .refine((f) => f.metric === "exercise" || f.unit === null, {
    message: "Only exercise fields have a unit",
    path: ["unit"],
  });
export type CellFieldCreate = z.input<typeof cellFieldCreateSchema>;

export const cellFieldPatchSchema = z.strictObject({ caption: cellCaptionSchema });

export const cellFieldOrderSchema = z.strictObject({
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids"),
});

/** What every user's cells show until they change it: net and weight, then exercises and steps. */
export const DEFAULT_CELL_FIELDS = [
  { metric: "net", caption: "N" },
  { metric: "weight", caption: "lb" },
  { metric: "exercises", caption: "Ex" },
  { metric: "steps", caption: "St" },
] as const satisfies readonly { metric: CellMetric; caption: string }[];

/** A caption to start from: "N" for net, "lb" for weight, "Walk" for a label named Walking. */
export function suggestCaption(metric: CellMetric, labelName?: string) {
  switch (metric) {
    case "in":
      return "In";
    case "active":
      return "Act";
    case "base":
      return "Base";
    case "out":
      return "Out";
    case "net":
      return "N";
    case "weight":
      return "lb";
    case "steps":
      return "St";
    case "distance":
      return "mi";
    case "exercises":
      return "Ex";
    case "exercise": {
      const name = (labelName ?? "Ex").trim();
      return name.length <= CELL_CAPTION_MAX ? name : name.slice(0, 4);
    }
  }
}

/** The day's value for a field, or null when there is nothing to show. */
export function cellValue(
  day: DaySummary,
  field: Pick<CellField, "metric" | "exerciseTypeId" | "unit">,
): number | null {
  const { metric } = field;
  switch (metric) {
    case "active":
      return day.caloriesActive;
    case "base":
      // Only on days the base counts toward.
      return day.caloriesOut !== null && day.caloriesBase > 0 ? day.caloriesBase : null;
    case "exercises":
      return day.exerciseCount > 0 ? day.exerciseCount : null;
    default:
      return highlightValue(day, { ...field, metric });
  }
}
