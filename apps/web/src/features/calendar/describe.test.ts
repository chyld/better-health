import type { DaySummary } from "@better-health/shared";
import { describe, expect, test } from "vitest";
import { describeDay, longDate } from "./describe";

const empty: DaySummary = {
  date: "2026-10-02",
  caloriesIn: null,
  caloriesActive: null,
  caloriesBase: 0,
  caloriesOut: null,
  net: null,
  weightLbs: null,
  steps: null,
  distanceMiles: null,
  exerciseCount: 0,
  exerciseTotals: [],
  hasNote: false,
};

describe("longDate", () => {
  test("formats without shifting the day across time zones", () => {
    expect(longDate("2026-10-02")).toBe("Friday, October 2");
    expect(longDate("2026-01-01")).toBe("Thursday, January 1");
  });
});

describe("describeDay", () => {
  test("an empty day is just its date", () => {
    expect(describeDay(empty)).toBe("Friday, October 2");
  });

  test("lists every value that is present", () => {
    expect(
      describeDay(
        {
          ...empty,
          caloriesIn: 1850,
          caloriesOut: 2600,
          net: -750,
          weightLbs: 182.4,
          steps: 12345,
          distanceMiles: 5.25,
          exerciseCount: 2,
          hasNote: true,
        },
        { today: true },
      ),
    ).toBe(
      "Friday, October 2, today, in 1850, out 2600, net minus 750, weight 182.4 pounds, 12345 steps, 5.25 miles, 2 exercises, has a note",
    );
  });

  test("singular exercise and positive net", () => {
    expect(
      describeDay({ ...empty, caloriesIn: 3000, caloriesOut: 2000, net: 1000, exerciseCount: 1 }),
    ).toBe("Friday, October 2, in 3000, out 2000, net 1000, 1 exercise");
  });

  test("a single step or mile", () => {
    expect(describeDay({ ...empty, steps: 1, distanceMiles: 1 })).toBe(
      "Friday, October 2, 1 step, 1 mile",
    );
  });

  test("names the highlight rule the day meets", () => {
    expect(describeDay({ ...empty, weightLbs: 182.4 }, { highlight: "Weight < 200.0 lbs" })).toBe(
      "Friday, October 2, weight 182.4 pounds, highlighted: Weight < 200.0 lbs",
    );
  });
});
