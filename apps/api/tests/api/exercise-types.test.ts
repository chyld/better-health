import { describe, expect, test } from "bun:test";
import type { ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const create = async (name: string, unit = "reps") =>
    (await (await send("POST", "/api/exercise-types", { name, unit })).json()) as ExerciseType;
  const list = async (query = "") =>
    (await (await send("GET", `/api/exercise-types${query}`)).json()) as ExerciseType[];
  return { ...t, cookie, send, create, list };
}

describe("exercise labels", () => {
  test("a new user has no labels", async () => {
    const s = await setup();
    expect(await s.list()).toEqual([]);
  });

  test("creates name + unit labels in order", async () => {
    const s = await setup();
    const res = await s.send("POST", "/api/exercise-types", {
      name: "  Walking ",
      unit: " miles ",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(Number),
      name: "Walking",
      unit: "miles",
      sortOrder: 0,
      archived: false,
      lastUsedOn: null,
    });
    await s.create("Pushups", "reps");
    expect((await s.list()).map((t) => [t.name, t.unit, t.sortOrder])).toEqual([
      ["Walking", "miles", 0],
      ["Pushups", "reps", 1],
    ]);
  });

  test("the same name with a different unit is a separate label", async () => {
    const s = await setup();
    await s.create("Walking", "miles");
    const res = await s.send("POST", "/api/exercise-types", { name: "Walking", unit: "minutes" });
    expect(res.status).toBe(201);
    expect((await s.list()).map((t) => t.unit)).toEqual(["miles", "minutes"]);
  });

  test("rejects a duplicate name + unit regardless of case", async () => {
    const s = await setup();
    await s.create("Walking", "miles");
    const res = await s.send("POST", "/api/exercise-types", { name: "WALKING", unit: "Miles" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "conflict", message: '"Walking (miles)" already exists' },
    });
  });

  test("a duplicate of an archived label suggests unarchiving", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga", "minutes");
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const res = await s.send("POST", "/api/exercise-types", { name: "yoga", unit: "minutes" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain(
      "unarchive",
    );
  });

  test.each([
    { name: "", unit: "miles" },
    { name: "   ", unit: "miles" },
    { name: "x".repeat(51), unit: "miles" },
    { name: "Walking" },
    { name: "Walking", unit: "" },
    { name: "Walking", unit: "x".repeat(21) },
    {},
    { name: 5, unit: "miles" },
  ])("rejects %p", async (body) => {
    const s = await setup();
    expect((await s.send("POST", "/api/exercise-types", body)).status).toBe(400);
  });

  test("renames a label and changes its unit; past entries follow", async () => {
    const s = await setup();
    const walk = await s.create("Walk", "mi");
    await s.send("POST", "/api/days/2026-10-01/exercises", { exerciseTypeId: walk.id, amount: 3 });
    const res = await s.send("PATCH", `/api/exercise-types/${walk.id}`, {
      name: "Walking",
      unit: "miles",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Walking", unit: "miles" });
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: { name: string; unit: string; amount: number }[];
    };
    expect(day.exercises[0]).toMatchObject({ name: "Walking", unit: "miles", amount: 3 });
  });

  test("changing only the case of the name is allowed", async () => {
    const s = await setup();
    const yoga = await s.create("yoga", "minutes");
    const res = await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { name: "Yoga" });
    expect(res.status).toBe(200);
  });

  test("an edit that collides with another label conflicts", async () => {
    const s = await setup();
    await s.create("Walking", "miles");
    const other = await s.create("Walking", "minutes");
    const res = await s.send("PATCH", `/api/exercise-types/${other.id}`, { unit: "MILES" });
    expect(res.status).toBe(409);
  });

  test("archiving hides a label from the default list but keeps it in the full list", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga");
    await s.create("Running");
    const res = await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    expect(((await res.json()) as ExerciseType).archived).toBe(true);
    expect((await s.list()).map((t) => t.name)).toEqual(["Running"]);
    expect((await s.list("?include=archived")).map((t) => [t.name, t.archived])).toEqual([
      ["Yoga", true],
      ["Running", false],
    ]);
  });

  test("an archived label still shows on past entries", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga", "minutes");
    await s.send("POST", "/api/days/2026-10-01/exercises", { exerciseTypeId: yoga.id, amount: 60 });
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: unknown[];
    };
    expect(day.exercises).toEqual([
      expect.objectContaining({ name: "Yoga", unit: "minutes", archived: true, amount: 60 }),
    ]);
  });

  test("unarchiving brings a label back", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga");
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: false });
    expect((await s.list()).map((t) => t.name)).toEqual(["Yoga"]);
  });

  test("reports the last date each label was used", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga");
    await s.create("Running");
    for (const date of ["2026-09-30", "2026-10-05", "2026-10-01"]) {
      await s.send("POST", `/api/days/${date}/exercises`, { exerciseTypeId: yoga.id, amount: 1 });
    }
    expect((await s.list()).map((t) => [t.name, t.lastUsedOn])).toEqual([
      ["Yoga", "2026-10-05"],
      ["Running", null],
    ]);
  });

  test("reorders labels", async () => {
    const s = await setup();
    const a = await s.create("A");
    await s.create("B");
    const c = await s.create("C");
    const res = await s.send("PUT", "/api/exercise-types/order", { ids: [c.id, a.id] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as ExerciseType[]).map((t) => t.name)).toEqual(["C", "A", "B"]);
    expect((await s.list()).map((t) => t.name)).toEqual(["C", "A", "B"]);
  });

  test("reorder rejects unknown ids and duplicates", async () => {
    const s = await setup();
    const a = await s.create("A");
    expect((await s.send("PUT", "/api/exercise-types/order", { ids: [a.id, 999] })).status).toBe(
      404,
    );
    expect((await s.send("PUT", "/api/exercise-types/order", { ids: [a.id, a.id] })).status).toBe(
      400,
    );
  });

  test("404 when patching an unknown label", async () => {
    const s = await setup();
    expect((await s.send("PATCH", "/api/exercise-types/999", { name: "X" })).status).toBe(404);
  });

  test("there is no delete", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga");
    expect((await s.send("DELETE", `/api/exercise-types/${yoga.id}`)).status).toBe(404);
  });
});
