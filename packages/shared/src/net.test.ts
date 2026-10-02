import { describe, expect, test } from "bun:test";
import { netCalories } from "./net";

describe("netCalories", () => {
  test("returns in minus out", () => {
    expect(netCalories(1850, 2600)).toBe(-750);
    expect(netCalories(3000, 2000)).toBe(1000);
    expect(netCalories(0, 0)).toBe(0);
  });

  test("returns null when either value is missing", () => {
    expect(netCalories(null, 2600)).toBeNull();
    expect(netCalories(1850, null)).toBeNull();
    expect(netCalories(null, null)).toBeNull();
  });
});
