import { describe, expect, test } from "bun:test";
import { type ExerciseType, HIGHLIGHT_RULES_MAX, type HighlightRule } from "@better-health/shared";
import { users } from "../../src/db/schema";
import { deleteExerciseType } from "../../src/services/exercise-types";
import { createTestApp } from "../helpers/app";

const weightUnder200 = {
  metric: "weight",
  exerciseTypeId: null,
  unit: null,
  operator: "<",
  target: 200,
  color: "green",
};

async function setup(username = "alice") {
  const t = createTestApp();
  const { cookie } = await t.signedInUser(username);
  const send = (method: string, path: string, body?: unknown, as = cookie) =>
    body === undefined ? t.request(path, { method, cookie: as }) : t.json(path, method, body, as);
  const create = async (rule: unknown) =>
    (await (await send("POST", "/api/highlights", rule)).json()) as HighlightRule;
  const list = async (as = cookie) =>
    (await (await send("GET", "/api/highlights", undefined, as)).json()) as HighlightRule[];
  const label = async (as = cookie) =>
    (await (
      await send("POST", "/api/exercise-types", { name: "Walking", category: "cardio" }, as)
    ).json()) as ExerciseType;
  return { ...t, cookie, send, create, list, label };
}

describe("highlight rules", () => {
  test("any of the 32 palette colours can be used", async () => {
    const s = await setup();
    const res = await s.send("POST", "/api/highlights", {
      ...weightUnder200,
      color: "indigo-bold",
    });
    expect(res.status).toBe(201);
    expect(
      (await s.send("POST", "/api/highlights", { ...weightUnder200, color: "gold" })).status,
    ).toBe(400);
  });

  test("a new user has none", async () => {
    const s = await setup();
    expect(await s.list()).toEqual([]);
  });

  test("creates rules at the end of the list", async () => {
    const s = await setup();
    const walking = await s.label();
    const res = await s.send("POST", "/api/highlights", weightUnder200);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: expect.any(Number), ...weightUnder200, sortOrder: 0 });
    await s.create({
      metric: "exercise",
      exerciseTypeId: walking.id,
      unit: "Miles",
      operator: ">=",
      target: 2.5,
      color: "blue",
    });
    // Without a unit, an exercise rule counts how many times it was logged.
    await s.create({
      metric: "exercise",
      exerciseTypeId: walking.id,
      operator: ">=",
      target: 1,
      color: "teal",
    });
    await s.create({ ...weightUnder200, metric: "net", operator: "<=", target: -500 });
    expect(
      (await s.list()).map((r) => [r.metric, r.unit, r.operator, r.target, r.sortOrder]),
    ).toEqual([
      ["weight", null, "<", 200, 0],
      ["exercise", "miles", ">=", 2.5, 1],
      ["exercise", null, ">=", 1, 2],
      ["net", null, "<=", -500, 3],
    ]);
  });

  test("rejects invalid rules", async () => {
    const s = await setup();
    for (const bad of [
      { ...weightUnder200, operator: "!=" },
      { ...weightUnder200, color: "#ff0000" },
      { ...weightUnder200, metric: "exercise" },
      { ...weightUnder200, exerciseTypeId: 1 },
      { ...weightUnder200, unit: "lbs" },
      { ...weightUnder200, target: "200" },
      { ...weightUnder200, extra: true },
    ]) {
      expect((await s.send("POST", "/api/highlights", bad)).status).toBe(400);
    }
    expect(await s.list()).toEqual([]);
  });

  test("an exercise rule needs one of the user's own labels", async () => {
    const s = await setup();
    const bob = (await s.signedInUser("bob")).cookie;
    const bobsLabel = await s.label(bob);
    const res = await s.send("POST", "/api/highlights", {
      ...weightUnder200,
      metric: "exercise",
      exerciseTypeId: bobsLabel.id,
    });
    expect(res.status).toBe(404);
  });

  test("reorders and deletes", async () => {
    const s = await setup();
    const a = await s.create(weightUnder200);
    const b = await s.create({ ...weightUnder200, color: "red" });
    const c = await s.create({ ...weightUnder200, color: "blue" });
    const reordered = await s.send("PUT", "/api/highlights/order", { ids: [c.id, a.id] });
    expect(((await reordered.json()) as HighlightRule[]).map((r) => r.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
    const deleted = await s.send("DELETE", `/api/highlights/${a.id}`);
    expect(deleted.status).toBe(200);
    expect(((await deleted.json()) as HighlightRule[]).map((r) => r.id)).toEqual([c.id, b.id]);
    expect((await s.send("DELETE", `/api/highlights/${a.id}`)).status).toBe(404);
  });

  test("has a limit", async () => {
    const s = await setup();
    for (let i = 0; i < HIGHLIGHT_RULES_MAX; i++) await s.create(weightUnder200);
    expect((await s.send("POST", "/api/highlights", weightUnder200)).status).toBe(409);
  });

  test("deleting a label (CLI) deletes its rules", async () => {
    const s = await setup();
    const walking = await s.label();
    await s.create({ ...weightUnder200, metric: "exercise", exerciseTypeId: walking.id });
    await s.create(weightUnder200);
    const userId = s.db.select().from(users).get()?.id ?? 0;
    deleteExerciseType(s.db, userId, walking.id);
    expect((await s.list()).map((r) => r.metric)).toEqual(["weight"]);
  });

  test("only the signed-in user's rules, and a session is required", async () => {
    const s = await setup();
    expect((await s.request("/api/highlights")).status).toBe(401);
    expect((await s.json("/api/highlights", "POST", weightUnder200)).status).toBe(401);
    const rule = await s.create(weightUnder200);
    const bob = (await s.signedInUser("bob")).cookie;
    expect(await s.list(bob)).toEqual([]);
    expect((await s.send("DELETE", `/api/highlights/${rule.id}`, undefined, bob)).status).toBe(404);
    expect((await s.send("PUT", "/api/highlights/order", { ids: [rule.id] }, bob)).status).toBe(
      404,
    );
    expect(await s.list()).toHaveLength(1);
  });
});
