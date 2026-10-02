import { describe, expect, test } from "bun:test";
import type { DayDetail, ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const newType = async (name: string) =>
    (await (await send("POST", "/api/exercise-types", { name })).json()) as ExerciseType;
  const add = (date: string, body: unknown) => send("POST", `/api/days/${date}/exercises`, body);
  return { ...t, cookie, send, newType, add };
}

describe("POST /api/days/:date/exercises", () => {
  test("adds an entry and returns the whole day", async () => {
    const s = await setup();
    const walking = await s.newType("Walking");
    const res = await s.add("2026-10-02", { exerciseTypeId: walking.id, note: "3 miles" });
    expect(res.status).toBe(201);
    const day = (await res.json()) as DayDetail;
    expect(day.exercises).toEqual([
      {
        id: expect.any(Number),
        exerciseTypeId: walking.id,
        name: "Walking",
        archived: false,
        note: "3 miles",
        createdAt: "2026-10-02T12:00:00.000Z",
      },
    ]);
  });

  test("lists entries in the order they were added", async () => {
    const s = await setup();
    const a = await s.newType("Walking");
    const b = await s.newType("Jumping jacks");
    await s.add("2026-10-02", { exerciseTypeId: a.id, note: "3 miles" });
    s.clock.advance(1000);
    const res = await s.add("2026-10-02", { exerciseTypeId: b.id, note: "5 sets" });
    const day = (await res.json()) as DayDetail;
    expect(day.exercises.map((e) => `${e.name} - ${e.note}`)).toEqual([
      "Walking - 3 miles",
      "Jumping jacks - 5 sets",
    ]);
  });

  test("the note is optional", async () => {
    const s = await setup();
    const yoga = await s.newType("Yoga");
    const day = (await (
      await s.add("2026-10-02", { exerciseTypeId: yoga.id })
    ).json()) as DayDetail;
    expect(day.exercises[0]?.note).toBe("");
  });

  test("the same label can be logged more than once a day", async () => {
    const s = await setup();
    const yoga = await s.newType("Yoga");
    await s.add("2026-10-02", { exerciseTypeId: yoga.id, note: "am" });
    const res = await s.add("2026-10-02", { exerciseTypeId: yoga.id, note: "pm" });
    expect(((await res.json()) as DayDetail).exercises).toHaveLength(2);
  });

  test("404 for a label that does not exist", async () => {
    const s = await setup();
    const res = await s.add("2026-10-02", { exerciseTypeId: 999 });
    expect(res.status).toBe(404);
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
    { body: { exerciseTypeId: "1" } },
    { body: { exerciseTypeId: 1, note: "x".repeat(501) } },
    { body: { exerciseTypeId: 1, calories: 300 } },
  ])("rejects $body", async ({ body }) => {
    const s = await setup();
    expect((await s.add("2026-10-02", body)).status).toBe(400);
  });
});

describe("PATCH /api/days/:date/exercises/:id", () => {
  test("changes the note and/or label", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const run = await s.newType("Running");
    const added = (await (
      await s.add("2026-10-02", { exerciseTypeId: walk.id, note: "3 miles" })
    ).json()) as DayDetail;
    const id = added.exercises[0]?.id;

    const res = await s.send("PATCH", `/api/days/2026-10-02/exercises/${id}`, {
      exerciseTypeId: run.id,
      note: "2 miles",
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]).toMatchObject({
      name: "Running",
      note: "2 miles",
    });
  });

  test("404 when the entry is on a different date", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = (await (
      await s.add("2026-10-02", { exerciseTypeId: walk.id })
    ).json()) as DayDetail;
    const res = await s.send("PATCH", `/api/days/2026-10-03/exercises/${added.exercises[0]?.id}`, {
      note: "x",
    });
    expect(res.status).toBe(404);
  });

  test("keeps an archived label when only the note changes", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = (await (
      await s.add("2026-10-02", { exerciseTypeId: walk.id })
    ).json()) as DayDetail;
    await s.send("PATCH", `/api/exercise-types/${walk.id}`, { archived: true });
    const res = await s.send("PATCH", `/api/days/2026-10-02/exercises/${added.exercises[0]?.id}`, {
      note: "edited",
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises[0]).toMatchObject({
      name: "Walking",
      archived: true,
      note: "edited",
    });
  });

  test("rejects an empty patch and a bad id", async () => {
    const s = await setup();
    expect((await s.send("PATCH", "/api/days/2026-10-02/exercises/1", {})).status).toBe(400);
    expect(
      (await s.send("PATCH", "/api/days/2026-10-02/exercises/abc", { note: "x" })).status,
    ).toBe(400);
  });
});

describe("DELETE /api/days/:date/exercises/:id", () => {
  test("removes the entry", async () => {
    const s = await setup();
    const walk = await s.newType("Walking");
    const added = (await (
      await s.add("2026-10-02", { exerciseTypeId: walk.id })
    ).json()) as DayDetail;
    const res = await s.send("DELETE", `/api/days/2026-10-02/exercises/${added.exercises[0]?.id}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as DayDetail).exercises).toEqual([]);
  });

  test("404 for an unknown entry", async () => {
    const s = await setup();
    expect((await s.send("DELETE", "/api/days/2026-10-02/exercises/999")).status).toBe(404);
  });
});
