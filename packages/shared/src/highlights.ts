import { z } from "zod";
import { PALETTE_COLORS, type PaletteColor } from "./palette";
import { exerciseUnitSchema } from "./schemas";
import type { DaySummary, HighlightRule } from "./types";

export const HIGHLIGHT_METRICS = [
  "in",
  "out",
  "net",
  "weight",
  "steps",
  "distance",
  "exercise",
] as const;
export type HighlightMetric = (typeof HIGHLIGHT_METRICS)[number];

export const HIGHLIGHT_OPERATORS = ["<", "<=", "=", ">=", ">"] as const;
export type HighlightOperator = (typeof HIGHLIGHT_OPERATORS)[number];

/** Highlight rules colour cells from the shared 32-colour palette. */
export const HIGHLIGHT_COLORS = PALETTE_COLORS;
export type HighlightColor = PaletteColor;

export const HIGHLIGHT_RULES_MAX = 50;
export const HIGHLIGHT_TARGET_MAX = 100_000;

export const highlightRuleCreateSchema = z
  .strictObject({
    metric: z.enum(HIGHLIGHT_METRICS),
    exerciseTypeId: z.number().int().positive().nullable(),
    /** Exercise rules only: the unit to total, or null to count how many times. */
    unit: exerciseUnitSchema.nullable().default(null),
    operator: z.enum(HIGHLIGHT_OPERATORS),
    target: z
      .number()
      .min(-HIGHLIGHT_TARGET_MAX, `Amount must be at least -${HIGHLIGHT_TARGET_MAX}`)
      .max(HIGHLIGHT_TARGET_MAX, `Amount must be at most ${HIGHLIGHT_TARGET_MAX}`)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
        "Amount allows two decimal places",
      ),
    color: z.enum(HIGHLIGHT_COLORS),
  })
  .refine((r) => (r.metric === "exercise") === (r.exerciseTypeId !== null), {
    message: "Pick an exercise label for an exercise rule, and only then",
    path: ["exerciseTypeId"],
  })
  .refine((r) => r.metric === "exercise" || r.unit === null, {
    message: "Only exercise rules have a unit",
    path: ["unit"],
  });
export type HighlightRuleCreate = z.input<typeof highlightRuleCreateSchema>;

export const highlightRuleOrderSchema = z.strictObject({
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids"),
});

/** The day's value for a rule's metric, or null when nothing is logged for it. */
export function highlightValue(
  day: DaySummary,
  rule: Pick<HighlightRule, "metric" | "exerciseTypeId" | "unit">,
): number | null {
  switch (rule.metric) {
    case "in":
      return day.caloriesIn;
    case "out":
      return day.caloriesOut;
    case "net":
      return day.net;
    case "weight":
      return day.weightLbs;
    case "steps":
      return day.steps;
    case "distance":
      return day.distanceMiles;
    case "exercise":
      return (
        day.exerciseTotals.find(
          (t) => t.exerciseTypeId === rule.exerciseTypeId && t.unit === rule.unit,
        )?.amount ?? null
      );
  }
}

/** Values are logged with at most two decimals; compare at that precision. */
const round = (n: number) => Math.round(n * 100);

function compare(value: number, operator: HighlightOperator, target: number): boolean {
  const a = round(value);
  const b = round(target);
  switch (operator) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    case ">=":
      return a >= b;
    case ">":
      return a > b;
  }
}

/** The first rule, in list order, that the day meets. A day with no value never matches. */
export function matchHighlight(
  day: DaySummary,
  rules: readonly HighlightRule[],
): HighlightRule | undefined {
  return rules.find((rule) => {
    const value = highlightValue(day, rule);
    return value !== null && compare(value, rule.operator, rule.target);
  });
}
