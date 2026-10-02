import { describe, expect, test } from "bun:test";
import type { ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const create = async (name: string) =>
    (await (await send("POST", "/api/exercise-types", { name })).json()) as ExerciseType;
  const list = async (query = "") =>
    (await (await send("GET", `/api/exercise-types${query}`)).json()) as ExerciseType[];
  return { ...t, cookie, send, create, list };
}

describe("exercise labels", () => {
  test("a new user has no labels", async () => {
    const s = await setup();
    expect(await s.list()).toEqual([]);
  });

  test("creates labels in order", async () => {
    const s = await setup();
    const res = await s.send("POST", "/api/exercise-types", { name: "  Pushups " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(Number),
      name: "Pushups",
      sortOrder: 0,
      archived: false,
      lastUsedOn: null,
    });
    await s.create("Situps");
    expect((await s.list()).map((t) => [t.name, t.sortOrder])).toEqual([
      ["Pushups", 0],
      ["Situps", 1],
    ]);
  });

  test("rejects a duplicate name regardless of case", async () => {
    const s = await setup();
    await s.create("Yoga");
    const res = await s.send("POST", "/api/exercise-types", { name: "YOGA" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "conflict", message: '"Yoga" already exists' },
    });
  });

  test("a duplicate of an archived label suggests unarchiving", async () => {
    const s = await setup();
    const yoga = await s.create("Yoga");
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const res = await s.send("POST", "/api/exercise-types", { name: "yoga" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain(
      "unarchive",
    );
  });

  test.each([{ name: "" }, { name: "   " }, { name: "x".repeat(51) }, {}, { name: 5 }])(
    "rejects %p",
    async (body) => {
      const s = await setup();
      expect((await s.send("POST", "/api/exercise-types", body)).status).toBe(400);
    },
  );

  test("renames a label, and past entries show the new name", async () => {
    const s = await setup();
    const walk = await s.create("Walk");
    await s.send("POST", "/api/days/2026-10-01/exercises", { exerciseTypeId: walk.id });
    const res = await s.send("PATCH", `/api/exercise-types/${walk.id}`, { name: "Walking" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as ExerciseType).name).toBe("Walking");
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: { name: string }[];
    };
    expect(day.exercises[0]?.name).toBe("Walking");
  });

  test("renaming to a different case of the same name is allowed", async () => {
    const s = await setup();
    const yoga = await s.create("yoga");
    const res = await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { name: "Yoga" });
    expect(res.status).toBe(200);
  });

  test("renaming onto another label's name conflicts", async () => {
    const s = await setup();
    await s.create("Yoga");
    const run = await s.create("Running");
    const res = await s.send("PATCH", `/api/exercise-types/${run.id}`, { name: "yoga" });
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
    await s.send("POST", "/api/days/2026-10-01/exercises", { exerciseTypeId: yoga.id, note: "1h" });
    await s.send("PATCH", `/api/exercise-types/${yoga.id}`, { archived: true });
    const day = (await (await s.send("GET", "/api/days/2026-10-01")).json()) as {
      exercises: unknown[];
    };
    expect(day.exercises).toEqual([expect.objectContaining({ name: "Yoga", archived: true })]);
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
      await s.send("POST", `/api/days/${date}/exercises`, { exerciseTypeId: yoga.id });
    }
    expect((await s.list()).map((t) => [t.name, t.lastUsedOn])).toEqual([
      ["Yoga", "2026-10-05"],
      ["Running", null],
    ]);
  });

  test("reorders labels", async () => {
    const s = await setup();
    const a = await s.create("A");
    const b = await s.create("B");
    const c = await s.create("C");
    const res = await s.send("PUT", "/api/exercise-types/order", { ids: [c.id, a.id] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as ExerciseType[]).map((t) => t.name)).toEqual(["C", "A", "B"]);
    expect((await s.list()).map((t) => t.name)).toEqual(["C", "A", "B"]);
    expect(b.id).toBeGreaterThan(0);
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
