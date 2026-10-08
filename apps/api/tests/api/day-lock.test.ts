import { describe, expect, test } from "bun:test";
import type { DayDetail, ExerciseType } from "@better-health/shared";
import { createTestApp } from "../helpers/app";

// Oct 8 at 21:00 UTC: still the afternoon of Oct 8 in Los Angeles, already Oct 9 in Tokyo.
async function setup() {
  const t = createTestApp("2026-10-08T21:00:00.000Z");
  const { cookie } = await t.signedInUser("alice");
  const send = (method: string, path: string, body?: unknown) =>
    body === undefined ? t.request(path, { method, cookie }) : t.json(path, method, body, cookie);
  const walk = (await (
    await send("POST", "/api/exercise-types", { name: "Walking", category: "cardio" })
  ).json()) as ExerciseType;
  return { ...t, cookie, send, walk };
}

describe("days lock after two days", () => {
  test.each(["2026-10-06", "2026-10-07", "2026-10-08"])("%p can be changed", async (date) => {
    const s = await setup();
    expect((await s.send("PATCH", `/api/days/${date}`, { caloriesIn: 1800 })).status).toBe(200);
  });

  test.each(["2026-10-05", "2025-10-08", "2026-10-09", "2027-01-01"])("%p cannot", async (date) => {
    const s = await setup();
    const res = await s.send("PATCH", `/api/days/${date}`, { caloriesIn: 1800 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "day_locked", message: "Only today and the 2 days before it can be changed" },
    });
    expect(
      ((await (await s.send("GET", `/api/days/${date}`)).json()) as DayDetail).caloriesIn,
    ).toBeNull();
  });

  test("exercises on a locked day cannot be added, measured or deleted", async () => {
    const s = await setup();
    s.travelTo("2026-10-05");
    const added = (await (
      await s.send("POST", "/api/days/2026-10-05/exercises", { exerciseTypeId: s.walk.id })
    ).json()) as DayDetail;
    const id = added.exercises[0]?.id as number;
    s.travelTo("2026-10-08");

    const path = "/api/days/2026-10-05/exercises";
    expect((await s.send("POST", path, { exerciseTypeId: s.walk.id })).status).toBe(403);
    expect(
      (await s.send("PATCH", `${path}/${id}`, { measurements: [{ unit: "miles", amount: 3 }] }))
        .status,
    ).toBe(403);
    expect((await s.send("DELETE", `${path}/${id}`)).status).toBe(403);

    // Still readable, unchanged.
    const day = (await (await s.send("GET", "/api/days/2026-10-05")).json()) as DayDetail;
    expect(day.exercises.map((e) => e.id)).toEqual([id]);
    expect(day.exercises[0]?.measurements).toEqual([]);
  });

  test("the day locks when the date changes", async () => {
    const s = await setup();
    s.clock.set("2026-10-08T23:59:00.000Z");
    expect((await s.send("PATCH", "/api/days/2026-10-06", { note: "late" })).status).toBe(200);
    s.clock.set("2026-10-09T00:01:00.000Z");
    expect((await s.send("PATCH", "/api/days/2026-10-06", { note: "too late" })).status).toBe(403);
  });

  test("an invalid date is still a validation error", async () => {
    const s = await setup();
    expect((await s.send("PATCH", "/api/days/2026-13-01", { note: "x" })).status).toBe(400);
  });
});

describe("time zone", () => {
  test("is UTC until set, and can be changed", async () => {
    const s = await setup();
    const me = async () => (await (await s.send("GET", "/api/auth/me")).json()) as unknown;
    expect(await me()).toMatchObject({ user: { timeZone: "UTC" } });

    const res = await s.send("PATCH", "/api/auth/me", { timeZone: "America/Los_Angeles" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { timeZone: "America/Los_Angeles" } });
    expect(await me()).toMatchObject({ user: { timeZone: "America/Los_Angeles" } });
  });

  test("decides which date is today", async () => {
    const s = await setup();
    await s.send("PATCH", "/api/auth/me", { timeZone: "Asia/Tokyo" });
    // 06:00 on Oct 9 in Tokyo: Oct 9 is open and Oct 6 has locked.
    expect((await s.send("PATCH", "/api/days/2026-10-09", { note: "x" })).status).toBe(200);
    expect((await s.send("PATCH", "/api/days/2026-10-06", { note: "x" })).status).toBe(403);

    await s.send("PATCH", "/api/auth/me", { timeZone: "America/Los_Angeles" });
    // 14:00 on Oct 8 in Los Angeles.
    expect((await s.send("PATCH", "/api/days/2026-10-09", { note: "x" })).status).toBe(403);
    expect((await s.send("PATCH", "/api/days/2026-10-06", { note: "x" })).status).toBe(200);
  });

  test.each([{ timeZone: "Mars/Olympus" }, { timeZone: "" }, {}, { timeZone: "UTC", x: 1 }])(
    "rejects %p",
    async (body) => {
      const s = await setup();
      expect((await s.send("PATCH", "/api/auth/me", body)).status).toBe(400);
    },
  );

  test("requires a session", async () => {
    const t = createTestApp();
    expect((await t.json("/api/auth/me", "PATCH", { timeZone: "UTC" })).status).toBe(401);
  });
});
