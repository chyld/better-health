import { describe, expect, test } from "vitest";
import { byRecentUse, categoriesOf, groupByCategory } from "./queries";

const t = (id: number, sortOrder: number, lastUsedOn: string | null, category = "cardio") => ({
  id,
  name: `t${id}`,
  category,
  sortOrder,
  archived: false,
  lastUsedOn,
  units: [],
});

describe("byRecentUse", () => {
  test("most recently used first, then unused in list order", () => {
    const sorted = byRecentUse([
      t(1, 0, null),
      t(2, 1, "2026-09-01"),
      t(3, 2, "2026-10-01"),
      t(4, 3, null),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([3, 2, 1, 4]);
  });

  test("does not mutate the input", () => {
    const input = [t(1, 1, null), t(2, 0, null)];
    byRecentUse(input);
    expect(input.map((x) => x.id)).toEqual([1, 2]);
  });
});

describe("categoriesOf", () => {
  test("distinct, case-insensitive, first spelling wins, sorted, blanks skipped", () => {
    const types = [
      t(1, 0, null, "strength"),
      t(2, 1, null, "Cardio"),
      t(3, 2, null, "cardio"),
      t(4, 3, null, ""),
    ];
    expect(categoriesOf(types)).toEqual(["Cardio", "strength"]);
  });
});

describe("groupByCategory", () => {
  test("keeps input order within and across groups; no category comes last", () => {
    const groups = groupByCategory([
      t(1, 0, null, "strength"),
      t(2, 1, null, ""),
      t(3, 2, null, "cardio"),
      t(4, 3, null, "Strength"),
    ]);
    expect(groups.map((g) => [g.category, g.types.map((x) => x.id)])).toEqual([
      ["strength", [1, 4]],
      ["cardio", [3]],
      ["", [2]],
    ]);
  });
});
