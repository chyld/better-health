import { beforeEach, describe, expect, test } from "bun:test";
import type { DayDetail, ExerciseType, MonthResponse } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

// Alice has data; Bob must not be able to see or touch any of it.
let t: ReturnType<typeof createTestApp>;
let alice: string;
let bob: string;
let aliceType: ExerciseType;
let aliceEntryId: number;
const DATE = "2026-10-02";

beforeEach(async () => {
  t = createTestApp();
  alice = (await t.signedInUser("alice")).cookie;
  bob = (await t.signedInUser("bob")).cookie;

  aliceType = (await (
    await t.json("/api/exercise-types", "POST", { name: "Yoga" }, alice)
  ).json()) as ExerciseType;
  await t.json(
    `/api/days/${DATE}`,
    "PATCH",
    { caloriesIn: 1850, caloriesOut: 2600, weightLbs: 182.4, note: "private" },
    alice,
  );
  const day = (await (
    await t.json(`/api/days/${DATE}/exercises`, "POST", { exerciseTypeId: aliceType.id }, alice)
  ).json()) as DayDetail;
  aliceEntryId = day.exercises[0]?.id ?? 0;
});

async function aliceDay() {
  return (await (await t.request(`/api/days/${DATE}`, { cookie: alice })).json()) as DayDetail;
}

describe("reads", () => {
  test("Bob's day is empty on a date Alice logged", async () => {
    const res = await t.request(`/api/days/${DATE}`, { cookie: bob });
    expect((await res.json()) as DayDetail).toMatchObject({
      caloriesIn: null,
      note: null,
      exercises: [],
    });
  });

  test("Bob's month shows none of Alice's data", async () => {
    const res = await t.request("/api/months/2026-10", { cookie: bob });
    const days = ((await res.json()) as MonthResponse).days;
    expect(days.every((d) => d.caloriesIn === null && d.exerciseCount === 0 && !d.hasNote)).toBe(
      true,
    );
  });

  test("Bob does not see Alice's labels", async () => {
    const res = await t.request("/api/exercise-types?include=archived", { cookie: bob });
    expect(await res.json()).toEqual([]);
  });
});

describe("writes to Alice's records are 404 and change nothing", () => {
  test("logging an exercise with Alice's label", async () => {
    const res = await t.json(
      `/api/days/${DATE}/exercises`,
      "POST",
      { exerciseTypeId: aliceType.id },
      bob,
    );
    expect(res.status).toBe(404);
  });

  test("editing Alice's exercise entry", async () => {
    const res = await t.json(
      `/api/days/${DATE}/exercises/${aliceEntryId}`,
      "PATCH",
      { note: "hacked" },
      bob,
    );
    expect(res.status).toBe(404);
    expect((await aliceDay()).exercises[0]?.note).toBe("");
  });

  test("moving his own entry onto Alice's label", async () => {
    const own = (await (
      await t.json("/api/exercise-types", "POST", { name: "Run" }, bob)
    ).json()) as ExerciseType;
    const day = (await (
      await t.json(`/api/days/${DATE}/exercises`, "POST", { exerciseTypeId: own.id }, bob)
    ).json()) as DayDetail;
    const res = await t.json(
      `/api/days/${DATE}/exercises/${day.exercises[0]?.id}`,
      "PATCH",
      { exerciseTypeId: aliceType.id },
      bob,
    );
    expect(res.status).toBe(404);
  });

  test("deleting Alice's exercise entry", async () => {
    const res = await t.request(`/api/days/${DATE}/exercises/${aliceEntryId}`, {
      method: "DELETE",
      cookie: bob,
    });
    expect(res.status).toBe(404);
    expect((await aliceDay()).exercises).toHaveLength(1);
  });

  test("renaming or archiving Alice's label", async () => {
    for (const body of [{ name: "Hacked" }, { archived: true }]) {
      const res = await t.json(`/api/exercise-types/${aliceType.id}`, "PATCH", body, bob);
      expect(res.status).toBe(404);
    }
    const list = (await (
      await t.request("/api/exercise-types", { cookie: alice })
    ).json()) as ExerciseType[];
    expect(list).toEqual([expect.objectContaining({ name: "Yoga", archived: false })]);
  });

  test("reordering with Alice's label", async () => {
    const res = await t.json("/api/exercise-types/order", "PUT", { ids: [aliceType.id] }, bob);
    expect(res.status).toBe(404);
  });

  test("Bob editing the same date only changes his own day", async () => {
    await t.json(`/api/days/${DATE}`, "PATCH", { caloriesIn: 1, note: null }, bob);
    expect(await aliceDay()).toMatchObject({ caloriesIn: 1850, note: "private" });
  });

  test("Bob can use the same label name as Alice", async () => {
    const res = await t.json("/api/exercise-types", "POST", { name: "Yoga" }, bob);
    expect(res.status).toBe(201);
  });
});
