import { describe, expect, test } from "bun:test";
import type { DayDetail, ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const newType = async (name: string, unit = "miles", category = "cardio") =>
    (await (
      await send("POST", "/api/exercise-types", { category: "cardio", name, unit })
    ).json()) as ExerciseType;
  const add = (date: string, body: unknown) => send("POST", `/api/days/${date}/exercises`, body);
  const addOk = async (date: string, body: unknown) =>
    (await (await add(date, body)).json()) as DayDetail;
  return { ...t, cookie, send, newType, add, addOk };
}

describe("POST /api/days/:date/exercises", () => {
  test("logs an amount of a label and returns the whole day", async () => {
    const s = await setup();
    const walking = await s.newType("Walking", "miles");
    const res = await s.add("2026-10-02", { exerciseTypeId: walking.id, amount: 3 });
    expect(res.status).toBe(201);
    expect(((await res.json()) as DayDetail).exercises).toEqual([
      {
        id: expect.any(Number),
        exerciseTypeId: walking.id,
        name: "Walking",
        category: "cardio",
        unit: "miles",
        archived: false,
        amount: 3,
        createdAt: "2026-10-02T12:00:00.000Z",
      },
    ]);
  });

  test("accepts decimal amounts", async () => {
    const s = await setup();
    const run = await s.newType("Running", "km");
    const day = await s.addOk("2026-10-02", { exerciseTypeId: run.id, amount: 5.25 });
    expect(day.exercises[0]?.amount).toBe(5.25);
  });

  test("lists entries in the order they were added", async () => {
    const s = await setup();
    const a = await s.newType("Walking", "miles");
    const b = await s.newType("Jumping jacks", "sets");
    await s.add("2026-10-02", { exerciseTypeId: a.id, amount: 3 });
    s.clock.advance(1000);
    const day = await s.addOk("2026-10-02", { exerciseTypeId: b.id, amount: 5 });
    expect(day.exercises.map((e) => `${e.name} ${e.amount} ${e.unit}`)).toEqual([
      "Walking 3 miles",
      "Jumping jacks 5 sets",
    ]);
  });

  test("the same label can be logged more than once a day", async () => {
    const s = await setup();
    const yoga = await s.newType("Yoga", "minutes");
    await s.add("2026-10-02", { exerciseTypeId: yoga.id, amount: 20 });
    const day = await s.addOk("2026-10-02", { exerciseTypeId: yoga.id, amount: 30 });
    expect(day.exercises).toHaveLength(2);
  });

  test("404 for a label that does not exist", async () => {
    const s = await setup();
    expect((await s.add("2026-10-02", { exerciseTypeId: 999, amount: 1 })).status).toBe(404);
  });

  test("400 for an archived label", async () => {
    const s = await setup();
    const yoga = await s.newType("Yoga", "minutes");
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const res = await s.add("2026-10-02", { exerciseTypeId: yoga.id, amount: 20 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "validation_error", message: '"Yoga" is archived' },
    });
  });

  test.each([
    { body: {} },
    { body: { exerciseTypeId: 1 } },
    { body: { exerciseTypeId: 1, amount: 0 } },
    { body: { exerciseTypeId: 1, amount: -3 } },
    { body: { exerciseTypeId: 1, amount: 3.125 } },
    { body: { exerciseTypeId: 1, amount: "3" } },
    { body: { exerciseTypeId: 1, amount: 100_001 } },
    { body: { exerciseTypeId: 1, amount: 3, note: "x" } },
  ])("rejects $body", async ({ body }) => {
    const s = await setup();
    expect((await s.add("2026-10-02", body)).status).toBe(400);
  });
});

describe("PATCH /api/days/:date/exercises/:id", () => {
  test("changes the amount and/or label", async () => {
    const s = await setup();
    const walk = await s.newType("Walking", "miles");
    const run = await s.newType("Running", "miles");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: walk.id, amount: 3 });
    const res = await s.send("PATCH", `/api/days/2026-10-02/exercises/${added.exercises[0]?.id}`, {
      exerciseTypeId: run.id,
      amount: 2.5,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]).toMatchObject({
      name: "Running",
      amount: 2.5,
    });
  });

  test("404 when the entry is on a different date", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: walk.id, amount: 1 });
    const res = await s.send("PATCH", `/api/days/2026-10-03/exercises/${added.exercises[0]?.id}`, {
      amount: 2,
    });
    expect(res.status).toBe(404);
  });

  test("keeps an archived label when only the amount changes", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: walk.id, amount: 1 });
    await s.send("PATCH", `/api/exercise-types/${walk.id}`, { archived: true });
    const res = await s.send("PATCH", `/api/days/2026-10-02/exercises/${added.exercises[0]?.id}`, {
      amount: 4,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]).toMatchObject({
      name: "Walking",
      archived: true,
      amount: 4,
    });
  });

  test("rejects an empty patch, a bad amount and a bad id", async () => {
    const s = await setup();
    expect((await s.send("PATCH", "/api/days/2026-10-02/exercises/1", {})).status).toBe(400);
    expect((await s.send("PATCH", "/api/days/2026-10-02/exercises/1", { amount: 0 })).status).toBe(
      400,
    );
    expect(
      (await s.send("PATCH", "/api/days/2026-10-02/exercises/abc", { amount: 1 })).status,
    ).toBe(400);
  });
});

describe("DELETE /api/days/:date/exercises/:id", () => {
  test("removes the entry", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: walk.id, amount: 1 });
    const res = await s.send("DELETE", `/api/days/2026-10-02/exercises/${added.exercises[0]?.id}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises).toEqual([]);
  });

  test("404 for an unknown entry", async () => {
    const s = await setup();
    expect((await s.send("DELETE", "/api/days/2026-10-02/exercises/999")).status).toBe(404);
  });
});
