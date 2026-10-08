import { expect, test } from "bun:test";
import type { DayDetail, ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

test("lists every day with anything logged, newest first, with its exercises", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  // Each write happens on its day: only recent days can be changed.
  const patch = (date: string, body: unknown) => {
    t.travelTo(date);
    return t.json(`/api/days/${date}`, "PATCH", body, cookie);
  };
  const walking = (await (
    await t.json("/api/exercise-types", "POST", { name: "Walking", category: "cardio" }, cookie)
  ).json()) as ExerciseType;
  const addExercise = (date: string, amount?: number) => {
    t.travelTo(date);
    return t.json(
      `/api/days/${date}/exercises`,
      "POST",
      {
        exerciseTypeId: walking.id,
        measurements: amount === undefined ? [] : [{ unit: "miles", amount }],
      },
      cookie,
    );
  };

  await patch("2026-09-15", { caloriesIn: 1800, caloriesActive: 2400, note: "older" });
  await patch("2026-10-02", { weightLbs: 182.4 });
  await addExercise("2026-10-02", 3);
  await addExercise("2026-10-02");
  await addExercise("2026-10-01", 2);

  const res = await t.request("/api/log", { cookie });
  expect(res.status).toBe(200);
  const days = (await res.json()) as DayDetail[];
  expect(days.map((d) => d.date)).toEqual(["2026-10-02", "2026-10-01", "2026-09-15"]);
  expect(days[0]).toMatchObject({ weightLbs: 182.4, caloriesIn: null, note: null });
  expect(days[0]?.exercises.map((e) => [e.name, e.category, e.measurements])).toEqual([
    ["Walking", "cardio", [{ unit: "miles", amount: 3 }]],
    ["Walking", "cardio", []],
  ]);
  expect(days[1]).toMatchObject({ caloriesIn: null, weightLbs: null, note: null });
  expect(days[1]?.exercises).toHaveLength(1);
  expect(days[2]).toEqual({
    date: "2026-09-15",
    caloriesIn: 1800,
    caloriesActive: 2400,
    caloriesBase: 0,
    caloriesOut: 2400,
    net: -600,
    weightLbs: null,
    steps: null,
    distanceMiles: null,
    note: "older",
    exercises: [],
  });
});

test("a day cleared of everything disappears", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  await t.json("/api/days/2026-10-02", "PATCH", { caloriesIn: 1 }, cookie);
  await t.json("/api/days/2026-10-02", "PATCH", { caloriesIn: null }, cookie);
  expect(await (await t.request("/api/log", { cookie })).json()).toEqual([]);
});

test("only the signed-in user's days, read only, and a session is required", async () => {
  const t = createTestApp();
  expect((await t.request("/api/log")).status).toBe(401);
  const alice = (await t.signedInUser("alice")).cookie;
  const bob = (await t.signedInUser("bob")).cookie;
  await t.json("/api/days/2026-10-02", "PATCH", { caloriesIn: 1, note: "alice's" }, alice);
  expect(await (await t.request("/api/log", { cookie: bob })).json()).toEqual([]);
  expect((await t.json("/api/log", "POST", {}, alice)).status).toBe(404);
});
