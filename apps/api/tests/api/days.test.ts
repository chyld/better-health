import { describe, expect, test } from "bun:test";
import type { DayDetail, MonthResponse } from "@better-health/shared";
import { DAY_MS } from "../../src/lib/clock";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { user, cookie } = await t.signedInUser("alice");
  const patch = (date: string, body: unknown) => t.json(`/api/days/${date}`, "PATCH", body, cookie);
  const day = async (date: string) =>
    (await (await t.request(`/api/days/${date}`, { cookie })).json()) as DayDetail;
  const month = async (m: string) =>
    (await (await t.request(`/api/months/${m}`, { cookie })).json()) as MonthResponse;
  return { ...t, user, cookie, patch, day, month };
}

describe("GET /api/days/:date", () => {
  test("an untouched day is all empty", async () => {
    const s = await setup();
    expect(await s.day("2026-10-02")).toEqual({
      date: "2026-10-02",
      caloriesIn: null,
      caloriesOut: null,
      net: null,
      weightLbs: null,
      note: null,
      exercises: [],
    });
  });

  test.each(["2026-02-30", "2026-10-2", "yesterday", "2026-13-01"])(
    "rejects invalid date %p",
    async (date) => {
      const s = await setup();
      const res = await s.request(`/api/days/${date}`, { cookie: s.cookie });
      expect(res.status).toBe(400);
    },
  );

  test("requires a session", async () => {
    const res = await createTestApp().request("/api/days/2026-10-02");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/days/:date", () => {
  test("sets values and computes net", async () => {
    const s = await setup();
    const res = await s.patch("2026-10-02", { caloriesIn: 1850, caloriesOut: 2600 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DayDetail;
    expect(body).toMatchObject({ caloriesIn: 1850, caloriesOut: 2600, net: -750 });
  });

  test("net is null until both in and out are set", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { caloriesIn: 1850 });
    expect((await s.day("2026-10-02")).net).toBeNull();
    await s.patch("2026-10-02", { caloriesOut: 1000 });
    expect((await s.day("2026-10-02")).net).toBe(850);
  });

  test("updates only the fields sent", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { caloriesIn: 1850, caloriesOut: 2600, weightLbs: 182.4 });
    await s.patch("2026-10-02", { note: "felt good" });
    expect(await s.day("2026-10-02")).toMatchObject({
      caloriesIn: 1850,
      caloriesOut: 2600,
      weightLbs: 182.4,
      note: "felt good",
    });
  });

  test("null clears a field", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { caloriesIn: 1850, weightLbs: 182.4 });
    await s.patch("2026-10-02", { weightLbs: null });
    expect(await s.day("2026-10-02")).toMatchObject({ caloriesIn: 1850, weightLbs: null });
  });

  test("a blank note is stored as no note", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { note: "   " });
    expect((await s.day("2026-10-02")).note).toBeNull();
  });

  test("keeps the note's text exactly, including line breaks", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { note: "line one\n  line two " });
    expect((await s.day("2026-10-02")).note).toBe("line one\n  line two ");
  });

  test("clearing every field leaves the day empty in the month view", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { caloriesIn: 1, note: "x" });
    await s.patch("2026-10-02", { caloriesIn: null, note: null });
    const d = (await s.month("2026-10")).days[1];
    expect(d).toMatchObject({ caloriesIn: null, hasNote: false });
  });

  test("zero is a real value", async () => {
    const s = await setup();
    await s.patch("2026-10-02", { caloriesIn: 0, caloriesOut: 0 });
    expect(await s.day("2026-10-02")).toMatchObject({ caloriesIn: 0, caloriesOut: 0, net: 0 });
  });

  test.each([
    { body: {} },
    { body: { caloriesIn: -1 } },
    { body: { caloriesIn: 20_001 } },
    { body: { caloriesIn: 12.5 } },
    { body: { caloriesIn: "1850" } },
    { body: { weightLbs: 182.45 } },
    { body: { weightLbs: 20 } },
    { body: { net: 100 } },
    { body: { note: "x".repeat(10_001) } },
  ])("rejects $body", async ({ body }) => {
    const s = await setup();
    const res = await s.patch("2026-10-02", body);
    expect(res.status).toBe(400);
  });

  test("records when the day was updated", async () => {
    const s = await setup();
    s.clock.advance(DAY_MS);
    await s.patch("2026-10-02", { caloriesIn: 1 });
    const row = s.db.query.dailyLogs.findFirst();
    expect((await row)?.updatedAt).toBe("2026-10-03T12:00:00.000Z");
  });
});

describe("GET /api/months/:month", () => {
  test("returns every day of the month, empty or not", async () => {
    const s = await setup();
    const body = await s.month("2026-02");
    expect(body.month).toBe("2026-02");
    expect(body.days).toHaveLength(28);
    expect(body.days[0]).toEqual({
      date: "2026-02-01",
      caloriesIn: null,
      caloriesOut: null,
      net: null,
      weightLbs: null,
      exerciseCount: 0,
      hasNote: false,
    });
  });

  test("summarizes logged days", async () => {
    const s = await setup();
    await s.patch("2026-10-02", {
      caloriesIn: 1850,
      caloriesOut: 2600,
      weightLbs: 182.4,
      note: "hi",
    });
    const type = (await (
      await s.json(
        "/api/exercise-types",
        "POST",
        { category: "cardio", name: "Walking", unit: "miles" },
        s.cookie,
      )
    ).json()) as { id: number };
    for (const amount of [3, 1]) {
      await s.json(
        "/api/days/2026-10-02/exercises",
        "POST",
        { exerciseTypeId: type.id, amount },
        s.cookie,
      );
    }
    const day = (await s.month("2026-10")).days.find((d) => d.date === "2026-10-02");
    expect(day).toEqual({
      date: "2026-10-02",
      caloriesIn: 1850,
      caloriesOut: 2600,
      net: -750,
      weightLbs: 182.4,
      exerciseCount: 2,
      hasNote: true,
    });
  });

  test("includes the first and last day and nothing outside the month", async () => {
    const s = await setup();
    for (const date of ["2026-09-30", "2026-10-01", "2026-10-31", "2026-11-01"]) {
      await s.patch(date, { caloriesIn: Number(date.slice(-2)) });
    }
    const days = (await s.month("2026-10")).days;
    expect(days[0]?.caloriesIn).toBe(1);
    expect(days.at(-1)?.caloriesIn).toBe(31);
    expect(days.filter((d) => d.caloriesIn !== null)).toHaveLength(2);
  });

  test("handles a leap-year February", async () => {
    const s = await setup();
    await s.patch("2024-02-29", { weightLbs: 180 });
    const days = (await s.month("2024-02")).days;
    expect(days).toHaveLength(29);
    expect(days.at(-1)).toMatchObject({ date: "2024-02-29", weightLbs: 180 });
  });

  test.each(["2026-13", "2026-1", "2026-10-01", "oct"])("rejects %p", async (m) => {
    const s = await setup();
    expect((await s.request(`/api/months/${m}`, { cookie: s.cookie })).status).toBe(400);
  });
});
