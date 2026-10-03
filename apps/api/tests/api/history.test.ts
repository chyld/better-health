import { expect, test } from "bun:test";
import type { HistoryDay } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

test("lists every day with calories or weight, newest first, with net", async () => {
  const t = createTestApp();
  const { cookie } = await t.signedInUser("alice");
  const patch = (date: string, body: unknown) => t.json(`/api/days/${date}`, "PATCH", body, cookie);
  await patch("2026-09-15", { caloriesIn: 1800, caloriesOut: 2400 });
  await patch("2026-10-02", { weightLbs: 182.4 });
  await patch("2026-10-01", { note: "only a note" });
  await patch("2025-12-31", { caloriesIn: 2100 });

  const res = await t.request("/api/history", { cookie });
  expect(res.status).toBe(200);
  expect((await res.json()) as HistoryDay[]).toEqual([
    { date: "2026-10-02", caloriesIn: null, caloriesOut: null, net: null, weightLbs: 182.4 },
    { date: "2026-09-15", caloriesIn: 1800, caloriesOut: 2400, net: -600, weightLbs: null },
    { date: "2025-12-31", caloriesIn: 2100, caloriesOut: null, net: null, weightLbs: null },
  ]);
});

test("only the signed-in user's days, and a session is required", async () => {
  const t = createTestApp();
  expect((await t.request("/api/history")).status).toBe(401);
  const alice = (await t.signedInUser("alice")).cookie;
  const bob = (await t.signedInUser("bob")).cookie;
  await t.json("/api/days/2026-10-02", "PATCH", { caloriesIn: 1 }, alice);
  expect(await (await t.request("/api/history", { cookie: bob })).json()).toEqual([]);
});
