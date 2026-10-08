import { describe, expect, test } from "bun:test";
import {
  CELL_METRICS,
  cellFieldCreateSchema,
  cellValue,
  DEFAULT_CELL_FIELDS,
  suggestCaption,
} from "./cells";
import type { DaySummary } from "./types";

const day: DaySummary = {
  date: "2026-10-02",
  caloriesIn: 2500,
  caloriesActive: 1000,
  caloriesBase: 2000,
  caloriesOut: 3000,
  net: -500,
  weightLbs: 182.4,
  steps: 12_345,
  distanceMiles: 5.25,
  exerciseCount: 3,
  exerciseTotals: [
    { exerciseTypeId: 7, unit: null, amount: 2 },
    { exerciseTypeId: 7, unit: "miles", amount: 3.5 },
    { exerciseTypeId: 9, unit: null, amount: 1 },
  ],
  hasNote: false,
};
const empty: DaySummary = {
  ...day,
  caloriesIn: null,
  caloriesActive: null,
  caloriesOut: null,
  net: null,
  weightLbs: null,
  steps: null,
  distanceMiles: null,
  exerciseCount: 0,
  exerciseTotals: [],
};
const field = (
  metric: (typeof CELL_METRICS)[number],
  exerciseTypeId: number | null = null,
  unit: string | null = null,
) => ({
  metric,
  exerciseTypeId,
  unit,
});

describe("cellValue", () => {
  test.each([
    ["in", 2500],
    ["active", 1000],
    ["base", 2000],
    ["out", 3000],
    ["net", -500],
    ["weight", 182.4],
    ["steps", 12_345],
    ["distance", 5.25],
    ["exercises", 3],
  ] as const)("%s", (metric, value) => {
    expect(cellValue(day, field(metric))).toBe(value);
  });

  test("a label's count, or the total of one unit", () => {
    expect(cellValue(day, field("exercise", 7))).toBe(2);
    expect(cellValue(day, field("exercise", 7, "miles"))).toBe(3.5);
    expect(cellValue(day, field("exercise", 9))).toBe(1);
    expect(cellValue(day, field("exercise", 9, "miles"))).toBeNull();
    expect(cellValue(day, field("exercise", 8))).toBeNull();
  });

  test("is null for every field on an empty day, base included", () => {
    for (const metric of CELL_METRICS) {
      expect(cellValue(empty, field(metric, metric === "exercise" ? 7 : null))).toBeNull();
    }
  });

  test("base only shows on days it counts toward", () => {
    expect(cellValue({ ...day, caloriesBase: 0 }, field("base"))).toBeNull();
  });
});

describe("cellFieldCreateSchema", () => {
  test("defaults the unit and trims the caption", () => {
    expect(
      cellFieldCreateSchema.parse({ metric: "net", exerciseTypeId: null, caption: " N " }),
    ).toEqual({
      metric: "net",
      exerciseTypeId: null,
      unit: null,
      caption: "N",
      color: null,
    });
  });
  test.each([
    { metric: "net", exerciseTypeId: null, caption: "" },
    { metric: "net", exerciseTypeId: null, caption: "Toolong" },
    { metric: "exercise", exerciseTypeId: null, caption: "Walk" },
    { metric: "net", exerciseTypeId: 3, caption: "N" },
    { metric: "net", exerciseTypeId: null, unit: "miles", caption: "N" },
    { metric: "mood", exerciseTypeId: null, caption: "M" },
  ])("rejects %p", (body) => {
    expect(cellFieldCreateSchema.safeParse(body).success).toBe(false);
  });
});

describe("captions", () => {
  test("every default and suggestion fits", () => {
    for (const f of DEFAULT_CELL_FIELDS)
      expect(cellFieldCreateSchema.safeParse({ ...f, exerciseTypeId: null }).success).toBe(true);
    for (const metric of CELL_METRICS) {
      expect(suggestCaption(metric, "Mountain biking").length).toBeLessThanOrEqual(6);
    }
  });
  test("a label's name, shortened when long", () => {
    expect(suggestCaption("exercise", "Yoga")).toBe("Yoga");
    expect(suggestCaption("exercise", "Walking")).toBe("Walk");
    expect(suggestCaption("exercise", "Rowing")).toBe("Rowing");
  });
});
