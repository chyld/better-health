import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  datesInMonth,
  daysInMonth,
  formatDate,
  isValidIsoDate,
  isValidIsoMonth,
  localIsoDate,
  parseMonth,
  shiftMonth,
} from "./dates";

describe("daysInMonth", () => {
  test.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2026, 4, 30],
    [2026, 12, 31],
    [2024, 2, 29],
    [2000, 2, 29],
    [1900, 2, 28],
    [2100, 2, 28],
  ])("%i-%i has %i days", (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days);
  });
});

describe("isValidIsoDate", () => {
  test.each(["2026-10-02", "2024-02-29", "2026-12-31", "2026-01-01"])("accepts %p", (d) => {
    expect(isValidIsoDate(d)).toBe(true);
  });

  test.each([
    "2026-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "2026-10-00",
    "2026-10-2",
    "26-10-02",
    "2026/10/02",
    "2026-10-02T00:00",
    "1899-12-31",
    "",
  ])("rejects %p", (d) => {
    expect(isValidIsoDate(d)).toBe(false);
  });
});

describe("isValidIsoMonth", () => {
  test("accepts YYYY-MM", () => {
    expect(isValidIsoMonth("2026-10")).toBe(true);
  });
  test.each(["2026-13", "2026-00", "2026-1", "2026-10-01", "x"])("rejects %p", (m) => {
    expect(isValidIsoMonth(m)).toBe(false);
  });
});

describe("parseMonth", () => {
  test("splits a month", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
  });
  test("throws on garbage", () => {
    expect(() => parseMonth("nope")).toThrow();
  });
});

describe("datesInMonth", () => {
  test("lists every day of February in a leap year", () => {
    const dates = datesInMonth("2024-02");
    expect(dates).toHaveLength(29);
    expect(dates[0]).toBe("2024-02-01");
    expect(dates.at(-1)).toBe("2024-02-29");
  });

  test("property: every listed date is valid, in order, and in that month", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1900, max: 2999 }), fc.integer({ min: 1, max: 12 }), (y, m) => {
        const month = `${y}-${String(m).padStart(2, "0")}`;
        const dates = datesInMonth(month);
        expect(dates.length).toBe(daysInMonth(y, m));
        for (const [i, d] of dates.entries()) {
          expect(isValidIsoDate(d)).toBe(true);
          expect(d.startsWith(month)).toBe(true);
          expect(d).toBe(formatDate(y, m, i + 1));
        }
      }),
    );
  });
});

describe("shiftMonth", () => {
  test.each([
    ["2026-10", 1, "2026-11"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
    ["2026-10", -22, "2024-12"],
    ["2026-10", 0, "2026-10"],
  ])("%s %+i = %s", (from, delta, to) => {
    expect(shiftMonth(from, delta)).toBe(to);
  });

  test("property: shifting forward then back is identity", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1950, max: 2900 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: -500, max: 500 }),
        (y, m, delta) => {
          const month = `${y}-${String(m).padStart(2, "0")}`;
          expect(shiftMonth(shiftMonth(month, delta), -delta)).toBe(month);
        },
      ),
    );
  });
});

describe("localIsoDate", () => {
  test("uses local calendar fields, not UTC", () => {
    expect(localIsoDate(new Date(2026, 9, 2, 23, 59))).toBe("2026-10-02");
    expect(localIsoDate(new Date(2026, 9, 3, 0, 1))).toBe("2026-10-03");
  });
});
