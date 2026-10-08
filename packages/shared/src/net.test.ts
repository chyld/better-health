import { describe, expect, test } from "bun:test";
import { baseCaloriesOn, dayCalories, netCalories } from "./net";

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

describe("baseCaloriesOn", () => {
  const changes = [
    { startsOn: "2027-01-01", calories: 1900 },
    { startsOn: "2026-10-08", calories: 2000 },
  ];

  test("is 0 before the first change, or with none", () => {
    expect(baseCaloriesOn(changes, "2026-10-07")).toBe(0);
    expect(baseCaloriesOn([], "2026-10-08")).toBe(0);
  });

  test("uses the latest change starting on or before the date, in any order", () => {
    expect(baseCaloriesOn(changes, "2026-10-08")).toBe(2000);
    expect(baseCaloriesOn(changes, "2026-12-31")).toBe(2000);
    expect(baseCaloriesOn(changes, "2027-01-01")).toBe(1900);
    expect(baseCaloriesOn([...changes].reverse(), "2027-06-01")).toBe(1900);
  });
});

describe("dayCalories", () => {
  test("adds the base to active calories", () => {
    expect(dayCalories(2500, 1000, 2000)).toEqual({ caloriesOut: 3000, net: -500 });
    expect(dayCalories(null, 1000, 2000)).toEqual({ caloriesOut: 3000, net: null });
  });

  test("counts the base alone once calories in are entered", () => {
    expect(dayCalories(2500, null, 2000)).toEqual({ caloriesOut: 2000, net: 500 });
  });

  test("leaves a day without calories blank", () => {
    expect(dayCalories(null, null, 2000)).toEqual({ caloriesOut: null, net: null });
  });

  test("with no base, behaves as before: out is what was entered", () => {
    expect(dayCalories(2500, 3600, 0)).toEqual({ caloriesOut: 3600, net: -1100 });
    expect(dayCalories(2500, null, 0)).toEqual({ caloriesOut: null, net: null });
  });
});
