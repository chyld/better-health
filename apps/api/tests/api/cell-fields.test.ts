import { describe, expect, test } from "bun:test";
import { CELL_FIELDS_MAX, type CellField, type ExerciseType } from "@better-health/shared";
import { deleteExerciseType } from "../../src/services/exercise-types";
import { createTestApp } from "../helpers/app";

async function setup() {
  const t = createTestApp();
  const { user, cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const list = async () => (await (await send("GET", "/api/cell-fields")).json()) as CellField[];
  const add = (body: unknown) => send("POST", "/api/cell-fields", body);
  const label = async (name: string) =>
    (await (
      await send("POST", "/api/exercise-types", { name, category: "cardio" })
    ).json()) as ExerciseType;
  const shown = async () =>
    (await list()).map((f) => [f.metric, f.exerciseTypeId, f.unit, f.caption]);
  return { ...t, user, cookie, send, list, add, label, shown };
}

describe("calendar cell fields", () => {
  test("a new user starts with net, weight, exercises and steps", async () => {
    const s = await setup();
    expect(await s.shown()).toEqual([
      ["net", null, null, "N"],
      ["weight", null, null, "lb"],
      ["exercises", null, null, "Ex"],
      ["steps", null, null, "St"],
    ]);
  });

  test("adds any metric or exercise at the end, with its caption", async () => {
    const s = await setup();
    const walk = await s.label("Walking");
    expect((await s.add({ metric: "out", exerciseTypeId: null, caption: "Out" })).status).toBe(201);
    await s.add({ metric: "exercise", exerciseTypeId: walk.id, unit: "Miles", caption: " Walk " });
    const res = await s.add({ metric: "exercise", exerciseTypeId: walk.id, caption: "W×" });
    expect(res.status).toBe(201);
    expect(
      ((await res.json()) as CellField[]).slice(4).map((f) => [f.metric, f.unit, f.caption]),
    ).toEqual([
      ["out", null, "Out"],
      ["exercise", "miles", "Walk"],
      ["exercise", null, "W×"],
    ]);
  });

  test("renames, reorders and deletes", async () => {
    const s = await setup();
    const [net, weight, exercises, steps] = await s.list();
    const renamed = await s.send("PATCH", `/api/cell-fields/${net?.id}`, { caption: "Net" });
    expect(renamed.status).toBe(200);

    const reordered = await s.send("PUT", "/api/cell-fields/order", {
      ids: [steps?.id, net?.id],
    });
    expect(((await reordered.json()) as CellField[]).map((f) => f.caption)).toEqual([
      "St",
      "Net",
      "lb",
      "Ex",
    ]);

    await s.send("DELETE", `/api/cell-fields/${weight?.id}`);
    const after = await s.send("DELETE", `/api/cell-fields/${exercises?.id}`);
    expect(((await after.json()) as CellField[]).map((f) => f.caption)).toEqual(["St", "Net"]);
  });

  test("each has a colour, automatic until one is picked", async () => {
    const s = await setup();
    const [net] = await s.list();
    expect(net?.color).toBeNull();
    const res = await s.send("PATCH", `/api/cell-fields/${net?.id}`, { color: "teal-bold" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as CellField[])[0]).toMatchObject({
      caption: "N",
      color: "teal-bold",
    });
    await s.send("PATCH", `/api/cell-fields/${net?.id}`, { color: null });
    expect((await s.list())[0]?.color).toBeNull();

    await s.add({ metric: "in", exerciseTypeId: null, caption: "In", color: "amber" });
    expect((await s.list()).at(-1)?.color).toBe("amber");
  });

  test.each([{ color: "gold" }, { color: "teal-dark" }, {}, { caption: "N", x: 1 }])(
    "rejects the update %p",
    async (body) => {
      const s = await setup();
      const [net] = await s.list();
      expect((await s.send("PATCH", `/api/cell-fields/${net?.id}`, body)).status).toBe(400);
    },
  );

  test("all can be removed", async () => {
    const s = await setup();
    for (const f of await s.list()) await s.send("DELETE", `/api/cell-fields/${f.id}`);
    expect(await s.list()).toEqual([]);
  });

  test("deleting a label deletes its fields", async () => {
    const s = await setup();
    const walk = await s.label("Walking");
    await s.add({ metric: "exercise", exerciseTypeId: walk.id, caption: "Walk" });
    deleteExerciseType(s.db, s.user.id, walk.id);
    expect((await s.list()).map((f) => f.caption)).toEqual(["N", "lb", "Ex", "St"]);
  });

  test(`at most ${CELL_FIELDS_MAX}`, async () => {
    const s = await setup();
    for (let i = 4; i < CELL_FIELDS_MAX; i++) {
      expect((await s.add({ metric: "in", exerciseTypeId: null, caption: "In" })).status).toBe(201);
    }
    expect((await s.add({ metric: "in", exerciseTypeId: null, caption: "In" })).status).toBe(409);
  });

  test.each([
    { metric: "net", exerciseTypeId: null, caption: "Toolong" },
    { metric: "net", exerciseTypeId: null, caption: "  " },
    { metric: "exercise", exerciseTypeId: null, caption: "Ex" },
    { metric: "mood", exerciseTypeId: null, caption: "M" },
  ])("rejects %p", async (body) => {
    const s = await setup();
    expect((await s.add(body)).status).toBe(400);
  });

  test("belong to each user", async () => {
    const s = await setup();
    const { cookie: bob } = await s.signedInUser("bob");
    const bobs = (await (
      await s.request("/api/cell-fields", { cookie: bob })
    ).json()) as CellField[];
    const bobLabel = (await (
      await s.json("/api/exercise-types", "POST", { name: "Rowing", category: "cardio" }, bob)
    ).json()) as ExerciseType;

    expect(
      (await s.send("PATCH", `/api/cell-fields/${bobs[0]?.id}`, { caption: "x" })).status,
    ).toBe(404);
    expect((await s.send("DELETE", `/api/cell-fields/${bobs[0]?.id}`)).status).toBe(404);
    expect((await s.send("PUT", "/api/cell-fields/order", { ids: [bobs[0]?.id] })).status).toBe(
      404,
    );
    expect(
      (await s.add({ metric: "exercise", exerciseTypeId: bobLabel.id, caption: "Row" })).status,
    ).toBe(404);
    expect(await (await s.request("/api/cell-fields", { cookie: bob })).json()).toEqual(bobs);
  });

  test("require a session", async () => {
    expect((await createTestApp().request("/api/cell-fields")).status).toBe(401);
  });
});
