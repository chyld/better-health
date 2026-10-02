import { expect, test } from "bun:test";
import type { DayNote } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

test("lists every day with a note, newest first, text unchanged", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const patch = (date: string, body: unknown) => t.json(`/api/days/${date}`, "PATCH", body, cookie);
  await patch("2026-09-15", { note: "older" });
  await patch("2026-10-02", { note: "line one\n  line two" });
  await patch("2026-10-01", { caloriesIn: 1800 });
  await patch("2025-12-31", { note: "last year" });

  const res = await t.request("/api/notes", { cookie });
  expect(res.status).toBe(200);
  expect((await res.json()) as DayNote[]).toEqual([
    { date: "2026-10-02", note: "line one\n  line two" },
    { date: "2026-09-15", note: "older" },
    { date: "2025-12-31", note: "last year" },
  ]);
});

test("a cleared note disappears from the list", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  await t.json("/api/days/2026-10-02", "PATCH", { note: "x", caloriesIn: 1 }, cookie);
  await t.json("/api/days/2026-10-02", "PATCH", { note: null }, cookie);
  expect(await (await t.request("/api/notes", { cookie })).json()).toEqual([]);
});

test("only the signed-in user's notes", async () => {
  const t = createTestApp();
  const alice = (await t.signedInUser("alice")).cookie;
  const bob = (await t.signedInUser("bob")).cookie;
  await t.json("/api/days/2026-10-02", "PATCH", { note: "alice's" }, alice);
  expect(await (await t.request("/api/notes", { cookie: bob })).json()).toEqual([]);
});

test("requires a session and is read only", async () => {
  const t = createTestApp();
  expect((await t.request("/api/notes")).status).toBe(401);
  const { cookie } = await t.signedInUser("alice");
  expect((await t.json("/api/notes", "POST", { note: "x" }, cookie)).status).toBe(404);
});
