import { describe, expect, test } from "vitest";
import { byRecentUse } from "./queries";

const t = (id: number, sortOrder: number, lastUsedOn: string | null) => ({
  id,
  name: `t${id}`,
  sortOrder,
  archived: false,
  lastUsedOn,
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
