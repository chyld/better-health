import { describe, expect, test } from "bun:test";
import type {
  BaseCaloriesChange,
  DayDetail,
  HistoryDay,
  MonthResponse,
} from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup(username = "alice") {
  const t = createTestApp();
  const { cookie } = await t.signedInUser(username);
  const setBase = (calories: number, startsOn: string) =>
    t.json("/api/base-calories", "PUT", { calories, startsOn }, cookie);
  const changes = async () =>
    (await (await t.request("/api/base-calories", { cookie })).json()) as BaseCaloriesChange[];
  // Each write happens on its day: only recent days can be changed.
  const patch = (date: string, body: unknown) => {
    t.travelTo(date);
    return t.json(`/api/days/${date}`, "PATCH", body, cookie);
  };
  const day = async (date: string) =>
    (await (await t.request(`/api/days/${date}`, { cookie })).json()) as DayDetail;
  return { ...t, cookie, setBase, changes, patch, day };
}

describe("base calories", () => {
  test("start with no changes, so the base is 0", async () => {
    const s = await setup();
    expect(await s.changes()).toEqual([]);
    await s.patch("2026-10-08", { caloriesIn: 2500, caloriesActive: 1000 });
    expect(await s.day("2026-10-08")).toMatchObject({
      caloriesActive: 1000,
      caloriesBase: 0,
      caloriesOut: 1000,
      net: 1500,
    });
  });

  test("are added to active calories from their start date on", async () => {
    const s = await setup();
    const res = await s.setBase(2000, "2026-10-08");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ startsOn: "2026-10-08", calories: 2000 }]);

    await s.patch("2026-10-08", { caloriesIn: 2500, caloriesActive: 1000 });
    expect(await s.day("2026-10-08")).toMatchObject({
      caloriesIn: 2500,
      caloriesActive: 1000,
      caloriesBase: 2000,
      caloriesOut: 3000,
      net: -500,
    });
  });

  test("count alone once calories in are entered, but not on days without calories", async () => {
    const s = await setup();
    await s.setBase(2000, "2026-10-08");
    await s.patch("2026-10-09", { caloriesIn: 2500 });
    await s.patch("2026-10-10", { weightLbs: 182.4 });
    expect(await s.day("2026-10-09")).toMatchObject({ caloriesOut: 2000, net: 500 });
    expect(await s.day("2026-10-10")).toMatchObject({
      caloriesBase: 2000,
      caloriesOut: null,
      net: null,
    });
    expect(await s.day("2026-10-11")).toMatchObject({ caloriesBase: 2000, caloriesOut: null });
  });

  test("a later change leaves earlier days with the base they had", async () => {
    const s = await setup();
    await s.patch("2026-10-07", { caloriesIn: 2500, caloriesActive: 3600 });
    await s.setBase(2000, "2026-10-08");
    await s.patch("2026-10-19", { caloriesIn: 2500, caloriesActive: 1000 });
    await s.setBase(1900, "2026-10-20");
    // Logged after the change, but dated before it.
    await s.patch("2026-10-18", { caloriesIn: 2500, caloriesActive: 500 });
    await s.patch("2026-10-20", { caloriesIn: 2500, caloriesActive: 1000 });

    expect(await s.changes()).toEqual([
      { startsOn: "2026-10-20", calories: 1900 },
      { startsOn: "2026-10-08", calories: 2000 },
    ]);
    expect(await s.day("2026-10-07")).toMatchObject({ caloriesBase: 0, caloriesOut: 3600 });
    expect(await s.day("2026-10-18")).toMatchObject({ caloriesBase: 2000, caloriesOut: 2500 });
    expect(await s.day("2026-10-19")).toMatchObject({ caloriesBase: 2000, caloriesOut: 3000 });
    expect(await s.day("2026-10-20")).toMatchObject({ caloriesBase: 1900, caloriesOut: 2900 });
  });

  test("a second change on the same day replaces the first; changing back drops it", async () => {
    const s = await setup();
    await s.setBase(2000, "2026-10-08");
    await s.setBase(1900, "2026-11-01");
    await s.setBase(1950, "2026-11-01");
    expect(await s.changes()).toEqual([
      { startsOn: "2026-11-01", calories: 1950 },
      { startsOn: "2026-10-08", calories: 2000 },
    ]);
    await s.setBase(2000, "2026-11-01");
    expect(await s.changes()).toEqual([{ startsOn: "2026-10-08", calories: 2000 }]);
  });

  test("apply to the month, history and log as totals", async () => {
    const s = await setup();
    await s.setBase(2000, "2026-10-01");
    await s.patch("2026-10-02", { caloriesIn: 2500, caloriesActive: 1000 });

    const month = (await (
      await s.request("/api/months/2026-10", { cookie: s.cookie })
    ).json()) as MonthResponse;
    expect(month.days.find((d) => d.date === "2026-10-02")).toMatchObject({
      caloriesActive: 1000,
      caloriesBase: 2000,
      caloriesOut: 3000,
      net: -500,
    });
    expect(month.days.find((d) => d.date === "2026-10-03")).toMatchObject({
      caloriesBase: 2000,
      caloriesOut: null,
    });

    const history = (await (
      await s.request("/api/history", { cookie: s.cookie })
    ).json()) as HistoryDay[];
    expect(history).toEqual([
      {
        date: "2026-10-02",
        caloriesIn: 2500,
        caloriesActive: 1000,
        caloriesBase: 2000,
        caloriesOut: 3000,
        net: -500,
        weightLbs: null,
        steps: null,
        distanceMiles: null,
      },
    ]);

    const log = (await (await s.request("/api/log", { cookie: s.cookie })).json()) as DayDetail[];
    expect(log[0]).toMatchObject({ caloriesBase: 2000, caloriesOut: 3000, net: -500 });
  });

  test("belong to each user", async () => {
    const s = await setup();
    await s.setBase(2000, "2026-10-01");
    const { cookie: bob } = await s.signedInUser("bob");
    expect(await (await s.request("/api/base-calories", { cookie: bob })).json()).toEqual([]);
    await s.json("/api/days/2026-10-02", "PATCH", { caloriesActive: 1000 }, bob);
    expect(await (await s.request("/api/days/2026-10-02", { cookie: bob })).json()).toMatchObject({
      caloriesBase: 0,
      caloriesOut: 1000,
    });
  });

  test.each([
    { calories: -1, startsOn: "2026-10-08" },
    { calories: 10_001, startsOn: "2026-10-08" },
    { calories: 2000, startsOn: "tomorrow" },
    { calories: 2000 },
  ])("reject %p", async (body) => {
    const s = await setup();
    expect((await s.json("/api/base-calories", "PUT", body, s.cookie)).status).toBe(400);
  });

  test("require a session", async () => {
    const t = createTestApp();
    expect((await t.request("/api/base-calories")).status).toBe(401);
    expect(
      (await t.json("/api/base-calories", "PUT", { calories: 2000, startsOn: "2026-10-08" }))
        .status,
    ).toBe(401);
  });
});
