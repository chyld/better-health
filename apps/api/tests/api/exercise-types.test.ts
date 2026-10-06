import { describe, expect, test } from "bun:test";
import type { ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const create = async (name: string, category = "cardio") =>
    (await (await send("POST", "/api/exercise-types", { category, name })).json()) as ExerciseType;
  const log = (date: string, exerciseTypeId: number, measurements: unknown[] = []) =>
    send("POST", `/api/days/${date}/exercises`, { exerciseTypeId, measurements });
  const list = async (query = "") =>
    (await (await send("GET", `/api/exercise-types${query}`)).json()) as ExerciseType[];
  return { ...t, cookie, send, create, list, log };
}

describe("exercise labels", () => {
  test("a new user has no labels", async () => {
    const s = await setup();
    expect(await s.list()).toEqual([]);
  });

  test("creates name + category labels in order", async () => {
    const s = await setup();
    const res = await s.send("POST", "/api/exercise-types", {
      name: "  Walking ",
      category: " cardio ",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(Number),
      name: "Walking",
      category: "cardio",
      sortOrder: 0,
      archived: false,
      lastUsedOn: null,
      units: [],
    });
    await s.create("Pushups", "strength");
    expect((await s.list()).map((t) => [t.name, t.category, t.sortOrder])).toEqual([
      ["Walking", "cardio", 0],
      ["Pushups", "strength", 1],
    ]);
  });

  test("rejects a duplicate name regardless of case or category", async () => {
    const s = await setup();
    await s.create("Walking");
    const res = await s.send("POST", "/api/exercise-types", {
      category: "outdoors",
      name: "WALKING",
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "conflict", message: '"Walking" already exists' },
    });
  });

  test("a duplicate of an archived label suggests unarchiving", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga");
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const res = await s.send("POST", "/api/exercise-types", { category: "cardio", name: "yoga" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain(
      "unarchive",
    );
  });

  test.each([
    { name: "", category: "cardio" },
    { name: "   ", category: "cardio" },
    { name: "x".repeat(51), category: "cardio" },
    { name: "Walking", category: "cardio", unit: "miles" },
    { name: "Walking" },
    { name: "Walking", category: "  " },
    { name: "Walking", category: "x".repeat(31) },
    {},
    { name: 5, category: "cardio" },
  ])("rejects %p", async (body) => {
    const s = await setup();
    expect((await s.send("POST", "/api/exercise-types", body)).status).toBe(400);
  });

  test("renames a label; past entries follow", async () => {
    const s = await setup();
    const walk = await s.create("Walk");
    await s.log("2026-10-01", walk.id, [{ unit: "miles", amount: 3 }]);
    const res = await s.send("PATCH", `/api/exercise-types/${walk.id}`, { name: "Walking" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Walking", units: ["miles"] });
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: unknown[];
    };
    expect(day.exercises[0]).toMatchObject({
      name: "Walking",
      measurements: [{ unit: "miles", amount: 3 }],
    });
  });

  test("changes a label's category; past entries follow", async () => {
    const s = await setup();
    const walk = await s.create("Walking", "cardio");
    await s.log("2026-10-01", walk.id);
    const res = await s.send("PATCH", `/api/exercise-types/${walk.id}`, { category: " outdoors " });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Walking", category: "outdoors" });
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: { category: string }[];
    };
    expect(day.exercises[0]?.category).toBe("outdoors");
    const blank = await s.send("PATCH", `/api/exercise-types/${walk.id}`, { category: "" });
    expect(blank.status).toBe(400);
    const unit = await s.send("PATCH", `/api/exercise-types/${walk.id}`, { unit: "miles" });
    expect(unit.status).toBe(400);
  });

  test("changing only the case of the name is allowed", async () => {
    const s = await setup();
    const yoga = await s.create("yoga");
    const res = await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { name: "Yoga" });
    expect(res.status).toBe(200);
  });

  test("an edit that collides with another label conflicts", async () => {
    const s = await setup();
    await s.create("Walking");
    const other = await s.create("Running");
    const res = await s.send("PATCH", `/api/exercise-types/${other.id}`, { name: "WALKING" });
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
    const yoga = await s.create("Yoga");
    await s.log("2026-10-01", yoga.id, [{ unit: "minutes", amount: 60 }]);
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: unknown[];
    };
    expect(day.exercises).toEqual([
      expect.objectContaining({
        name: "Yoga",
        archived: true,
        measurements: [{ unit: "minutes", amount: 60 }],
      }),
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
      await s.log(date, yoga.id);
    }
    expect((await s.list()).map((t) => [t.name, t.lastUsedOn])).toEqual([
      ["Yoga", "2026-10-05"],
      ["Running", null],
    ]);
  });

  test("lists the units measured with each label, most recently used first", async () => {
    const s = await setup();
    const run = await s.create("Running");
    const yoga = await s.create("Yoga");
    await s.log("2026-10-01", run.id, [
      { unit: "miles", amount: 3 },
      { unit: "minutes", amount: 30 },
    ]);
    await s.log("2026-10-03", run.id, [{ unit: "km", amount: 5 }]);
    await s.log("2026-10-02", run.id, [{ unit: "Miles", amount: 2 }]);
    await s.log("2026-10-02", yoga.id);
    expect((await s.list()).map((t) => [t.name, t.units])).toEqual([
      ["Running", ["km", "miles", "minutes"]],
      ["Yoga", []],
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
