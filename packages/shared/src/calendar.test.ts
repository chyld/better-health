import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { calendarWeeks, formatCompact, formatNumber, formatWeight } from "./calendar";
import { datesInMonth } from "./dates";

describe("calendarWeeks", () => {
  test("October 2026 starts on a Thursday", () => {
    const weeks = calendarWeeks("2026-10");
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks).toHaveLength(5);
    expect(weeks.at(-1)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  test("February 2026 starts on a Sunday and fits in exactly 4 weeks", () => {
    const weeks = calendarWeeks("2026-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]).toBe("2026-02-01");
    expect(weeks[3]?.[6]).toBe("2026-02-28");
  });

  test("a 31-day month starting on Saturday needs 6 weeks", () => {
    const weeks = calendarWeeks("2026-08");
    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[6]).toBe("2026-08-01");
    expect(weeks[5]?.[1]).toBe("2026-08-31");
  });

  test("leap-year February ends on the 29th", () => {
    expect(calendarWeeks("2024-02").flat().filter(Boolean).at(-1)).toBe("2024-02-29");
  });

  test("property: weeks are full, Sunday-first, and hold each date once in order", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1900, max: 2999 }), fc.integer({ min: 1, max: 12 }), (y, m) => {
        const month = `${y}-${String(m).padStart(2, "0")}`;
        const weeks = calendarWeeks(month);
        expect(weeks.length).toBeGreaterThanOrEqual(4);
        expect(weeks.length).toBeLessThanOrEqual(6);
        for (const week of weeks) expect(week).toHaveLength(7);
        expect(weeks.flat().filter((d) => d !== null)).toEqual(datesInMonth(month));
        for (const [i, date] of weeks.flat().entries()) {
          if (date) expect(new Date(`${date}T00:00:00Z`).getUTCDay()).toBe(i % 7);
        }
        expect(weeks[0]?.some((d) => d !== null)).toBe(true);
        expect(weeks.at(-1)?.some((d) => d !== null)).toBe(true);
      }),
    );
  });
});

describe("formatNumber", () => {
  test.each([
    [0, "0"],
    [950, "950"],
    [1850, "1,850"],
    [20000, "20,000"],
    [-750, "−750"],
    [-1250, "−1,250"],
  ])("%p → %p", (n, s) => {
    expect(formatNumber(n)).toBe(s);
  });

  test("signed adds + to positive values only", () => {
    expect(formatNumber(1000, { signed: true })).toBe("+1,000");
    expect(formatNumber(0, { signed: true })).toBe("0");
    expect(formatNumber(-5, { signed: true })).toBe("−5");
  });
});

describe("formatCompact", () => {
  test.each([
    [0, "0"],
    [999, "999"],
    [1000, "1k"],
    [1850, "1.9k"],
    [1949, "1.9k"],
    [1950, "2k"],
    [2600, "2.6k"],
    [12345, "12.3k"],
    [20000, "20k"],
    [-750, "−750"],
    [-1250, "−1.3k"],
  ])("%p → %p", (n, s) => {
    expect(formatCompact(n)).toBe(s);
  });

  test("signed adds + to positive values", () => {
    expect(formatCompact(1500, { signed: true })).toBe("+1.5k");
  });

  test("property: never longer than 6 characters for valid calorie values", () => {
    fc.assert(
      fc.property(fc.integer({ min: -20000, max: 20000 }), (n) => {
        expect(formatCompact(n, { signed: true }).length).toBeLessThanOrEqual(6);
      }),
    );
  });
});

describe("formatWeight", () => {
  test("always shows one decimal", () => {
    expect(formatWeight(182)).toBe("182.0");
    expect(formatWeight(182.4)).toBe("182.4");
  });
});
