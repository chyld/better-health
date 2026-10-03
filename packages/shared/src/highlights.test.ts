import { describe, expect, test } from "bun:test";
import {
  HIGHLIGHT_OPERATORS,
  type HighlightOperator,
  highlightRuleCreateSchema,
  matchHighlight,
} from "./highlights";
import type { DaySummary, HighlightRule } from "./types";

const day: DaySummary = {
  date: "2026-10-02",
  caloriesIn: 1850,
  caloriesOut: 2600,
  net: -750,
  weightLbs: 182.4,
  exerciseCount: 3,
  exerciseTotals: [
    { exerciseTypeId: 7, amount: 3.5 },
    { exerciseTypeId: 9, amount: 0.3 },
  ],
  hasNote: false,
};
const empty: DaySummary = {
  date: "2026-10-03",
  caloriesIn: null,
  caloriesOut: null,
  net: null,
  weightLbs: null,
  exerciseCount: 0,
  exerciseTotals: [],
  hasNote: false,
};

let nextId = 1;
function rule(r: Partial<HighlightRule>): HighlightRule {
  return {
    id: nextId++,
    metric: "weight",
    exerciseTypeId: null,
    operator: "<",
    target: 200,
    color: "green",
    sortOrder: 0,
    ...r,
  };
}

describe("matchHighlight", () => {
  test.each([
    ["<", 182.4, false],
    ["<", 182.5, true],
    ["<=", 182.4, true],
    ["<=", 182.3, false],
    ["=", 182.4, true],
    ["=", 182, false],
    [">=", 182.4, true],
    [">=", 182.5, false],
    [">", 182.3, true],
    [">", 182.4, false],
  ] as [HighlightOperator, number, boolean][])("weight %s %d → %p", (operator, target, hit) => {
    expect(Boolean(matchHighlight(day, [rule({ operator, target })]))).toBe(hit);
  });

  test("reads each metric", () => {
    expect(matchHighlight(day, [rule({ metric: "in", operator: "=", target: 1850 })])).toBeTruthy();
    expect(
      matchHighlight(day, [rule({ metric: "out", operator: ">", target: 2500 })]),
    ).toBeTruthy();
    expect(matchHighlight(day, [rule({ metric: "net", operator: "<", target: 0 })])).toBeTruthy();
    expect(matchHighlight(day, [rule({ metric: "net", operator: ">", target: 0 })])).toBeFalsy();
  });

  test("exercise rules compare the day's total for that label", () => {
    const walking = (operator: HighlightOperator, target: number) =>
      rule({ metric: "exercise", exerciseTypeId: 7, operator, target });
    expect(matchHighlight(day, [walking(">=", 3.5)])).toBeTruthy();
    expect(matchHighlight(day, [walking(">", 3.5)])).toBeFalsy();
    // 0.1 + 0.2 summed in floating point still equals 0.3.
    expect(
      matchHighlight({ ...day, exerciseTotals: [{ exerciseTypeId: 9, amount: 0.1 + 0.2 }] }, [
        rule({ metric: "exercise", exerciseTypeId: 9, operator: "=", target: 0.3 }),
      ]),
    ).toBeTruthy();
    expect(
      matchHighlight(day, [
        rule({ metric: "exercise", exerciseTypeId: 8, operator: ">=", target: 0 }),
      ]),
    ).toBeUndefined();
  });

  test("a day with nothing logged for the metric never matches", () => {
    for (const operator of HIGHLIGHT_OPERATORS) {
      expect(matchHighlight(empty, [rule({ operator, target: 0 })])).toBeUndefined();
      expect(matchHighlight(empty, [rule({ metric: "net", operator, target: 0 })])).toBeUndefined();
    }
  });

  test("the first matching rule in the list wins", () => {
    const first = rule({ target: 100, color: "red" });
    const second = rule({ target: 190, color: "blue" });
    const third = rule({ target: 200, color: "green" });
    expect(matchHighlight(day, [first, second, third])).toBe(second);
    expect(matchHighlight(day, [third, second])).toBe(third);
    expect(matchHighlight(day, [])).toBeUndefined();
  });
});

describe("highlightRuleCreateSchema", () => {
  const base = {
    metric: "weight",
    exerciseTypeId: null,
    operator: "<",
    target: 200,
    color: "green",
  };

  test("accepts a valid rule", () => {
    expect(highlightRuleCreateSchema.safeParse(base).success).toBe(true);
    expect(
      highlightRuleCreateSchema.safeParse({ ...base, metric: "net", target: -500 }).success,
    ).toBe(true);
    expect(
      highlightRuleCreateSchema.safeParse({ ...base, metric: "exercise", exerciseTypeId: 3 })
        .success,
    ).toBe(true);
  });

  test("an exercise label goes with an exercise rule, and only with one", () => {
    expect(highlightRuleCreateSchema.safeParse({ ...base, metric: "exercise" }).success).toBe(
      false,
    );
    expect(highlightRuleCreateSchema.safeParse({ ...base, exerciseTypeId: 3 }).success).toBe(false);
  });

  test("rejects unknown operators and colours, and odd amounts", () => {
    expect(highlightRuleCreateSchema.safeParse({ ...base, operator: "!=" }).success).toBe(false);
    expect(highlightRuleCreateSchema.safeParse({ ...base, color: "#ff0000" }).success).toBe(false);
    expect(highlightRuleCreateSchema.safeParse({ ...base, target: 1.234 }).success).toBe(false);
    expect(highlightRuleCreateSchema.safeParse({ ...base, target: 1e9 }).success).toBe(false);
  });
});
