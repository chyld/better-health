import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../../src/db/client";
import { sessions } from "../../src/db/schema";
import { DAY_MS, fixedClock } from "../../src/lib/clock";
import {
  createSession,
  deleteSession,
  SESSION_TTL_MS,
  sweepExpiredSessions,
  validateSession,
} from "../../src/services/sessions";
import { createTestDb } from "../helpers/db";
import { makeUser } from "../helpers/factories";

let db: Db;
let clock: ReturnType<typeof fixedClock>;
beforeEach(() => {
  db = createTestDb();
  clock = fixedClock("2026-10-02T12:00:00.000Z");
});

describe("createSession", () => {
  test("expires in 30 days", () => {
    const user = makeUser(db);
    const { expiresAt } = createSession(db, user.id, clock);
    expect(expiresAt.toISOString()).toBe("2026-11-01T12:00:00.000Z");
  });
});

describe("validateSession", () => {
  test("returns the user for a live session", () => {
    const user = makeUser(db, { username: "alice" });
    const { token } = createSession(db, user.id, clock);
    expect(validateSession(db, token, clock)?.user).toEqual({
      id: user.id,
      username: "alice",
      createdAt: user.createdAt,
      isAdmin: false,
    });
  });

  test("returns null for an unknown token", () => {
    expect(validateSession(db, "nope", clock)).toBeNull();
  });

  test("returns null at the exact expiry instant", () => {
    const user = makeUser(db);
    const { token } = createSession(db, user.id, clock);
    clock.advance(SESSION_TTL_MS);
    expect(validateSession(db, token, clock)).toBeNull();
  });

  test("does not renew within a day of the last renewal", () => {
    const user = makeUser(db);
    const { token } = createSession(db, user.id, clock);
    clock.advance(DAY_MS - 1);
    expect(validateSession(db, token, clock)?.renewedUntil).toBeNull();
  });

  test("renews to a full 30 days once a day has passed", () => {
    const user = makeUser(db);
    const { token } = createSession(db, user.id, clock);
    clock.advance(DAY_MS);
    const result = validateSession(db, token, clock);
    expect(result?.renewedUntil?.toISOString()).toBe("2026-11-02T12:00:00.000Z");
    expect(db.select().from(sessions).get()?.expiresAt).toBe("2026-11-02T12:00:00.000Z");
  });
});

describe("deleteSession", () => {
  test("removes only that session", () => {
    const user = makeUser(db);
    const a = createSession(db, user.id, clock);
    const b = createSession(db, user.id, clock);
    deleteSession(db, a.token);
    expect(validateSession(db, a.token, clock)).toBeNull();
    expect(validateSession(db, b.token, clock)).not.toBeNull();
  });
});

describe("sweepExpiredSessions", () => {
  test("removes expired sessions and keeps live ones", () => {
    const user = makeUser(db);
    createSession(db, user.id, clock);
    clock.advance(20 * DAY_MS);
    const live = createSession(db, user.id, clock);
    clock.advance(15 * DAY_MS);

    expect(sweepExpiredSessions(db, clock)).toBe(1);
    expect(db.select().from(sessions).all()).toHaveLength(1);
    expect(validateSession(db, live.token, clock)).not.toBeNull();
  });
});
