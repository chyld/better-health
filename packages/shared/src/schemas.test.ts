import { describe, expect, test } from "bun:test";
import { passwordSchema, usernameSchema } from "./schemas";

describe("usernameSchema", () => {
  test.each(["abc", "chyld", "a.b-c_d", "User99", "x".repeat(32)])("accepts %p", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  test.each(["", "ab", "x".repeat(33), "has space", "emoji🙂", "semi;colon"])(
    "rejects %p",
    (name) => {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    },
  );

  test("trims surrounding whitespace", () => {
    expect(usernameSchema.parse("  chyld  ")).toBe("chyld");
  });
});

describe("passwordSchema", () => {
  test("accepts any non-empty password", () => {
    for (const p of ["a", "1", " ", "abc", "password"]) {
      expect(passwordSchema.safeParse(p).success).toBe(true);
    }
    expect(passwordSchema.safeParse("").success).toBe(false);
  });

  test("rejects passwords over 256 characters", () => {
    expect(passwordSchema.safeParse("x".repeat(256)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(257)).success).toBe(false);
  });
});

import {
  caloriesSchema,
  dayPatchSchema,
  distanceSchema,
  exerciseEntryCreateSchema,
  exerciseEntryPatchSchema,
  exerciseTypeCreateSchema,
  exerciseTypeOrderSchema,
  exerciseTypePatchSchema,
  isoDateSchema,
  isoMonthSchema,
  stepsSchema,
  weightSchema,
} from "./schemas";

describe("isoDateSchema / isoMonthSchema", () => {
  test("validate real calendar values", () => {
    expect(isoDateSchema.safeParse("2026-10-02").success).toBe(true);
    expect(isoDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(isoMonthSchema.safeParse("2026-10").success).toBe(true);
    expect(isoMonthSchema.safeParse("2026-13").success).toBe(false);
  });
});

describe("caloriesSchema", () => {
  test.each([0, 1, 1850, 20_000])("accepts %p", (n) => {
    expect(caloriesSchema.safeParse(n).success).toBe(true);
  });
  test.each([-1, 20_001, 1.5, Number.NaN, "100"])("rejects %p", (n) => {
    expect(caloriesSchema.safeParse(n).success).toBe(false);
  });
});

describe("weightSchema", () => {
  test.each([50, 182.4, 182, 999.9, 1000, 0.1 + 182.2])("accepts %p", (n) => {
    expect(weightSchema.safeParse(n).success).toBe(true);
  });
  test.each([49.9, 1000.1, 182.45, -5, "182"])("rejects %p", (n) => {
    expect(weightSchema.safeParse(n).success).toBe(false);
  });
});

describe("stepsSchema", () => {
  test.each([0, 1, 12_345, 200_000])("accepts %p", (n) => {
    expect(stepsSchema.safeParse(n).success).toBe(true);
  });
  test.each([-1, 200_001, 10.5, "9000"])("rejects %p", (n) => {
    expect(stepsSchema.safeParse(n).success).toBe(false);
  });
});

describe("distanceSchema", () => {
  test.each([0, 0.01, 3, 5.25, 0.1 + 0.2, 200])("accepts %p", (n) => {
    expect(distanceSchema.safeParse(n).success).toBe(true);
  });
  test.each([-0.5, 200.01, 3.125, "3"])("rejects %p", (n) => {
    expect(distanceSchema.safeParse(n).success).toBe(false);
  });
});

describe("dayPatchSchema", () => {
  test("accepts any subset of fields, including null to clear", () => {
    expect(dayPatchSchema.safeParse({ caloriesIn: 1850 }).success).toBe(true);
    expect(dayPatchSchema.safeParse({ weightLbs: null, note: "hi" }).success).toBe(true);
    expect(dayPatchSchema.safeParse({ steps: 9000, distanceMiles: null }).success).toBe(true);
    expect(
      dayPatchSchema.safeParse({ caloriesIn: 1, caloriesOut: 2, weightLbs: 150, note: "" }).success,
    ).toBe(true);
  });
  test("rejects an empty patch and unknown fields", () => {
    expect(dayPatchSchema.safeParse({}).success).toBe(false);
    expect(dayPatchSchema.safeParse({ net: 5 }).success).toBe(false);
  });
  test("rejects a note over 10,000 characters", () => {
    expect(dayPatchSchema.safeParse({ note: "x".repeat(10_001) }).success).toBe(false);
  });
});

describe("exercise schemas", () => {
  test("entry create needs only a label", () => {
    expect(exerciseEntryCreateSchema.parse({ exerciseTypeId: 1 })).toEqual({
      exerciseTypeId: 1,
      measurements: [],
    });
    expect(exerciseEntryCreateSchema.safeParse({ exerciseTypeId: 0 }).success).toBe(false);
    expect(exerciseEntryCreateSchema.safeParse({ exerciseTypeId: 1, note: "x" }).success).toBe(
      false,
    );
  });
  test("measurements have a lowercased unit and an amount", () => {
    expect(
      exerciseEntryCreateSchema.parse({
        exerciseTypeId: 1,
        measurements: [{ unit: " Miles ", amount: 3 }],
      }).measurements,
    ).toEqual([{ unit: "miles", amount: 3 }]);
  });
  const withAmount = (amount: number) => ({
    exerciseTypeId: 1,
    measurements: [{ unit: "miles", amount }],
  });
  test.each([0, -1, 100_001, 3.125, Number.NaN])("measurement rejects amount %p", (amount) => {
    expect(exerciseEntryCreateSchema.safeParse(withAmount(amount)).success).toBe(false);
  });
  test.each([0.01, 3, 3.5, 2.25, 100_000])("measurement accepts amount %p", (amount) => {
    expect(exerciseEntryCreateSchema.safeParse(withAmount(amount)).success).toBe(true);
  });
  test("measurements need a unit, at most once each, and at most five", () => {
    const parse = (measurements: unknown) =>
      exerciseEntryPatchSchema.safeParse({ measurements }).success;
    expect(parse([{ unit: "  ", amount: 3 }])).toBe(false);
    expect(parse([{ unit: "x".repeat(21), amount: 3 }])).toBe(false);
    expect(parse([{ amount: 3 }])).toBe(false);
    expect(
      parse([
        { unit: "miles", amount: 3 },
        { unit: "MILES", amount: 4 },
      ]),
    ).toBe(false);
    const units = ["a", "b", "c", "d", "e", "f"].map((unit) => ({ unit, amount: 1 }));
    expect(parse(units.slice(0, 5))).toBe(true);
    expect(parse(units)).toBe(false);
    expect(parse([])).toBe(true);
  });
  test("entry patch needs at least one field", () => {
    expect(exerciseEntryPatchSchema.safeParse({}).success).toBe(false);
    expect(exerciseEntryPatchSchema.safeParse({ exerciseTypeId: 2 }).success).toBe(true);
    expect(exerciseEntryPatchSchema.safeParse({ amount: 4 }).success).toBe(false);
  });
  test("labels need a trimmed name and category, and have no unit", () => {
    const walking = { name: "  Walking ", category: " cardio " };
    expect(exerciseTypeCreateSchema.parse(walking)).toEqual({
      name: "Walking",
      category: "cardio",
    });
    const ok = { name: "Walking", category: "cardio" };
    for (const bad of [
      { name: "Walking" },
      { category: "cardio" },
      { ...ok, unit: "miles" },
      { ...ok, name: "   " },
      { ...ok, category: "  " },
      { ...ok, name: "x".repeat(51) },
      { ...ok, category: "x".repeat(31) },
    ]) {
      expect(exerciseTypeCreateSchema.safeParse(bad).success).toBe(false);
    }
  });
  test("label patch accepts name, category and/or archived", () => {
    expect(exerciseTypePatchSchema.safeParse({ archived: true }).success).toBe(true);
    expect(exerciseTypePatchSchema.safeParse({ category: "cardio" }).success).toBe(true);
    expect(exerciseTypePatchSchema.safeParse({ unit: "km" }).success).toBe(false);
    expect(exerciseTypePatchSchema.safeParse({}).success).toBe(false);
  });
  test("order rejects empty and duplicate ids", () => {
    expect(exerciseTypeOrderSchema.safeParse({ ids: [3, 1, 2] }).success).toBe(true);
    expect(exerciseTypeOrderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(exerciseTypeOrderSchema.safeParse({ ids: [1, 1] }).success).toBe(false);
  });
});
