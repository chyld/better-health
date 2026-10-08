import { describe, expect, test } from "bun:test";
import type { DayDetail, ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const newType = async (name: string, category = "cardio") =>
    (await (await send("POST", "/api/exercise-types", { category, name })).json()) as ExerciseType;
  const add = (date: string, body: unknown) => send("POST", `/api/days/${date}/exercises`, body);
  const addOk = async (date: string, body: unknown) =>
    (await (await add(date, body)).json()) as DayDetail;
  const patch = (date: string, id: number | undefined, body: unknown) =>
    send("PATCH", `/api/days/${date}/exercises/${id}`, body);
  return { ...t, cookie, send, newType, add, addOk, patch };
}

const miles = (amount: number) => ({ unit: "miles", amount });

describe("POST /api/days/:date/exercises", () => {
  test("logs a label with nothing else and returns the whole day", async () => {
    const s = await setup();
    const running = await s.newType("Running");
    const res = await s.add("2026-10-02", { exerciseTypeId: running.id });
    expect(res.status).toBe(201);
    expect(((await res.json()) as DayDetail).exercises).toEqual([
      {
        id: expect.any(Number),
        exerciseTypeId: running.id,
        name: "Running",
        category: "cardio",
        archived: false,
        measurements: [],
        createdAt: "2026-10-02T12:00:00.000Z",
      },
    ]);
  });

  test("can log measurements straight away, units lowercased", async () => {
    const s = await setup();
    const run = await s.newType("Running");
    const day = await s.addOk("2026-10-02", {
      exerciseTypeId: run.id,
      measurements: [
        { unit: "Miles", amount: 5.25 },
        { unit: "minutes", amount: 40 },
      ],
    });
    expect(day.exercises[0]?.measurements).toEqual([
      { unit: "miles", amount: 5.25 },
      { unit: "minutes", amount: 40 },
    ]);
  });

  test("lists entries in the order they were added", async () => {
    const s = await setup();
    const a = await s.newType("Walking");
    const b = await s.newType("Jumping jacks");
    await s.add("2026-10-02", { exerciseTypeId: a.id });
    s.clock.advance(1000);
    const day = await s.addOk("2026-10-02", { exerciseTypeId: b.id });
    expect(day.exercises.map((e) => e.name)).toEqual(["Walking", "Jumping jacks"]);
  });

  test("the same label can be logged more than once a day", async () => {
    const s = await setup();
    const yoga = await s.newType("Yoga");
    await s.add("2026-10-02", { exerciseTypeId: yoga.id });
    const day = await s.addOk("2026-10-02", { exerciseTypeId: yoga.id });
    expect(day.exercises).toHaveLength(2);
  });

  test("404 for a label that does not exist", async () => {
    const s = await setup();
    expect((await s.add("2026-10-02", { exerciseTypeId: 999 })).status).toBe(404);
  });

  test("400 for an archived label", async () => {
    const s = await setup();
    const yoga = await s.newType("Yoga");
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const res = await s.add("2026-10-02", { exerciseTypeId: yoga.id });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "validation_error", message: '"Yoga" is archived' },
    });
  });

  test.each([
    { body: {} },
    { body: { exerciseTypeId: 1, amount: 3 } },
    { body: { exerciseTypeId: 1, measurements: [miles(0)] } },
    { body: { exerciseTypeId: 1, measurements: [miles(-3)] } },
    { body: { exerciseTypeId: 1, measurements: [miles(3.125)] } },
    { body: { exerciseTypeId: 1, measurements: [miles(100_001)] } },
    { body: { exerciseTypeId: 1, measurements: [{ unit: "miles", amount: "3" }] } },
    { body: { exerciseTypeId: 1, measurements: [{ unit: " ", amount: 3 }] } },
    { body: { exerciseTypeId: 1, measurements: [miles(1), { unit: "MILES", amount: 2 }] } },
    { body: { exerciseTypeId: 1, note: "x" } },
  ])("rejects $body", async ({ body }) => {
    const s = await setup();
    expect((await s.add("2026-10-02", body)).status).toBe(400);
  });
});

describe("PATCH /api/days/:date/exercises/:id", () => {
  test("measurements replace the entry's list; an empty list clears it", async () => {
    const s = await setup();
    const run = await s.newType("Running");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: run.id });
    const id = added.exercises[0]?.id;

    let res = await s.patch("2026-10-02", id, { measurements: [miles(3)] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]?.measurements).toEqual([miles(3)]);

    res = await s.patch("2026-10-02", id, {
      measurements: [miles(3.5), { unit: "minutes", amount: 30 }],
    });
    expect(((await res.json()) as DayDetail).exercises[0]?.measurements).toEqual([
      miles(3.5),
      { unit: "minutes", amount: 30 },
    ]);

    res = await s.patch("2026-10-02", id, { measurements: [] });
    expect(((await res.json()) as DayDetail).exercises[0]?.measurements).toEqual([]);
  });

  test("changing the label keeps the measurements", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const run = await s.newType("Running");
    const added = await s.addOk("2026-10-02", {
      exerciseTypeId: walk.id,
      measurements: [miles(3)],
    });
    const res = await s.patch("2026-10-02", added.exercises[0]?.id, { exerciseTypeId: run.id });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]).toMatchObject({
      name: "Running",
      measurements: [miles(3)],
    });
  });

  test("404 when the entry is on a different date", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: walk.id });
    const res = await s.patch("2026-10-01", added.exercises[0]?.id, { measurements: [miles(2)] });
    expect(res.status).toBe(404);
  });

  test("an entry with an archived label can still be measured", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = await s.addOk("2026-10-02", { exerciseTypeId: walk.id });
    await s.send("PATCH", `/api/exercise-types/${walk.id}`, { archived: true });
    const res = await s.patch("2026-10-02", added.exercises[0]?.id, { measurements: [miles(4)] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]).toMatchObject({
      name: "Walking",
      archived: true,
      measurements: [miles(4)],
    });
  });

  test("rejects an empty patch, a bad measurement and a bad id", async () => {
    const s = await setup();
    expect((await s.patch("2026-10-02", 1, {})).status).toBe(400);
    expect((await s.patch("2026-10-02", 1, { measurements: [miles(0)] })).status).toBe(400);
    expect((await s.patch("2026-10-02", 1, { amount: 1 })).status).toBe(400);
    expect(
      (await s.send("PATCH", "/api/days/2026-10-02/exercises/abc", { measurements: [] })).status,
    ).toBe(400);
  });
});

describe("DELETE /api/days/:date/exercises/:id", () => {
  test("removes the entry and its measurements", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = await s.addOk("2026-10-02", {
      exerciseTypeId: walk.id,
      measurements: [miles(1)],
    });
    const res = await s.send("DELETE", `/api/days/2026-10-02/exercises/${added.exercises[0]?.id}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises).toEqual([]);
    expect(s.db.$client.query("select count(*) as n from exercise_measurements").get()).toEqual({
      n: 0,
    });
  });

  test("404 for an unknown entry", async () => {
    const s = await setup();
    expect((await s.send("DELETE", "/api/days/2026-10-02/exercises/999")).status).toBe(404);
  });
});
