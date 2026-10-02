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
  test("requires at least 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  test("rejects passwords over 256 characters", () => {
    expect(passwordSchema.safeParse("x".repeat(256)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(257)).success).toBe(false);
  });
});

import {
  caloriesSchema,
  dayPatchSchema,
  exerciseEntryCreateSchema,
  exerciseEntryPatchSchema,
  exerciseTypeCreateSchema,
  exerciseTypeOrderSchema,
  exerciseTypePatchSchema,
  isoDateSchema,
  isoMonthSchema,
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

describe("dayPatchSchema", () => {
  test("accepts any subset of fields, including null to clear", () => {
    expect(dayPatchSchema.safeParse({ caloriesIn: 1850 }).success).toBe(true);
    expect(dayPatchSchema.safeParse({ weightLbs: null, note: "hi" }).success).toBe(true);
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
  test("entry create defaults the note and trims it", () => {
    expect(exerciseEntryCreateSchema.parse({ exerciseTypeId: 1 })).toEqual({
      exerciseTypeId: 1,
      note: "",
    });
    expect(exerciseEntryCreateSchema.parse({ exerciseTypeId: 1, note: " 3 miles " }).note).toBe(
      "3 miles",
    );
  });
  test("entry create rejects bad ids and long notes", () => {
    expect(exerciseEntryCreateSchema.safeParse({ exerciseTypeId: 0 }).success).toBe(false);
    expect(
      exerciseEntryCreateSchema.safeParse({ exerciseTypeId: 1, note: "x".repeat(501) }).success,
    ).toBe(false);
  });
  test("entry patch needs at least one field", () => {
    expect(exerciseEntryPatchSchema.safeParse({}).success).toBe(false);
    expect(exerciseEntryPatchSchema.safeParse({ note: "5 sets" }).success).toBe(true);
  });
  test("type names are trimmed, required and capped at 50", () => {
    expect(exerciseTypeCreateSchema.parse({ name: "  Yoga " }).name).toBe("Yoga");
    expect(exerciseTypeCreateSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(exerciseTypeCreateSchema.safeParse({ name: "x".repeat(51) }).success).toBe(false);
  });
  test("type patch accepts name and/or archived", () => {
    expect(exerciseTypePatchSchema.safeParse({ archived: true }).success).toBe(true);
    expect(exerciseTypePatchSchema.safeParse({}).success).toBe(false);
  });
  test("order rejects empty and duplicate ids", () => {
    expect(exerciseTypeOrderSchema.safeParse({ ids: [3, 1, 2] }).success).toBe(true);
    expect(exerciseTypeOrderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(exerciseTypeOrderSchema.safeParse({ ids: [1, 1] }).success).toBe(false);
  });
});
