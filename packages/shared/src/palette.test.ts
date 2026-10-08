import { expect, test } from "bun:test";
import { highlightRuleCreateSchema } from "./highlights";
import { PALETTE_COLORS } from "./palette";

test("32 distinct colours: 16 soft hues and their bold shades", () => {
  expect(PALETTE_COLORS).toHaveLength(32);
  expect(new Set(PALETTE_COLORS).size).toBe(32);
  const colors: readonly string[] = PALETTE_COLORS;
  const soft = colors.filter((c) => !c.endsWith("-bold"));
  expect(colors.filter((c) => c.endsWith("-bold"))).toEqual(soft.map((c) => `${c}-bold`));
});

test("the 8 colours highlight rules used before are still valid", () => {
  for (const color of ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]) {
    expect(
      highlightRuleCreateSchema.safeParse({
        metric: "weight",
        exerciseTypeId: null,
        operator: "<",
        target: 200,
        color,
      }).success,
    ).toBe(true);
  }
});
