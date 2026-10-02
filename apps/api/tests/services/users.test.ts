import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../../src/db/client";
import { sessions, users } from "../../src/db/schema";
import { fixedClock } from "../../src/lib/clock";
import { ConflictError, NotFoundError, ValidationError } from "../../src/lib/errors";
import {
  createUser,
  deleteUser,
  findUserByUsername,
  listUsers,
  resetPassword,
  verifyCredentials,
} from "../../src/services/users";
import { createTestDb } from "../helpers/db";
import { makeDay, makeUser } from "../helpers/factories";

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

const addSession = (userId: number, tokenHash: string) =>
  db.insert(sessions).values({ tokenHash, userId, expiresAt: "x", createdAt: "x" }).run();

describe("createUser", () => {
  test("stores a hashed password and returns public fields only", async () => {
    const clock = fixedClock("2026-10-02T08:00:00.000Z");
    const user = await createUser(db, { username: "chyld", password: "password123" }, clock);
    expect(user).toEqual({ id: user.id, username: "chyld", createdAt: "2026-10-02T08:00:00.000Z" });
    expect(user).not.toHaveProperty("passwordHash");
    const row = db.select().from(users).get();
    expect(row?.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  test("trims the username", async () => {
    const user = await createUser(db, { username: "  chyld ", password: "password123" });
    expect(user.username).toBe("chyld");
  });

  test("rejects a duplicate username regardless of case", async () => {
    await createUser(db, { username: "chyld", password: "password123" });
    expect(createUser(db, { username: "CHYLD", password: "password123" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("rejects an invalid username", () => {
    expect(createUser(db, { username: "a b", password: "password123" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  test("accepts a one-character password", async () => {
    await createUser(db, { username: "chyld", password: "x" });
    expect(await verifyCredentials(db, "chyld", "x")).not.toBeNull();
  });

  test("rejects an empty password", () => {
    expect(createUser(db, { username: "chyld", password: "" })).rejects.toThrow(
      "Password cannot be empty",
    );
  });
});

describe("findUserByUsername", () => {
  test("matches case-insensitively", () => {
    const user = makeUser(db, { username: "Chyld" });
    expect(findUserByUsername(db, "chyld")?.id).toBe(user.id);
    expect(findUserByUsername(db, "nobody")).toBeUndefined();
  });
});

describe("listUsers", () => {
  test("returns users oldest first without password hashes", () => {
    makeUser(db, { username: "later", createdAt: "2026-10-02T00:00:00.000Z" });
    makeUser(db, { username: "earlier", createdAt: "2026-10-01T00:00:00.000Z" });
    const list = listUsers(db);
    expect(list.map((u) => u.username)).toEqual(["earlier", "later"]);
    expect(list[0]).not.toHaveProperty("passwordHash");
  });

  test("returns an empty list when there are no users", () => {
    expect(listUsers(db)).toEqual([]);
  });
});

describe("resetPassword", () => {
  test("changes the password and signs out every session of that user only", async () => {
    const a = await createUser(db, { username: "alice", password: "old-password" });
    const b = await createUser(db, { username: "bob", password: "bob-password" });
    addSession(a.id, "a1");
    addSession(a.id, "a2");
    addSession(b.id, "b1");

    await resetPassword(db, "alice", "new-password");

    expect(await verifyCredentials(db, "alice", "old-password")).toBeNull();
    expect((await verifyCredentials(db, "alice", "new-password"))?.id).toBe(a.id);
    expect(
      db
        .select()
        .from(sessions)
        .all()
        .map((s) => s.tokenHash),
    ).toEqual(["b1"]);
  });

  test("rejects an unknown user", () => {
    expect(resetPassword(db, "ghost", "new-password")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("rejects an empty password without changing anything", async () => {
    await createUser(db, { username: "alice", password: "old-password" });
    expect(resetPassword(db, "alice", "")).rejects.toBeInstanceOf(ValidationError);
    expect(await verifyCredentials(db, "alice", "old-password")).not.toBeNull();
  });
});

describe("deleteUser", () => {
  test("removes the user and their data", () => {
    const user = makeUser(db, { username: "alice" });
    makeDay(db, user.id);
    deleteUser(db, "ALICE");
    expect(listUsers(db)).toEqual([]);
  });

  test("rejects an unknown user", () => {
    expect(() => deleteUser(db, "ghost")).toThrow(NotFoundError);
  });
});

describe("verifyCredentials", () => {
  test("returns the user for a correct password, case-insensitive username", async () => {
    await createUser(db, { username: "Alice", password: "password123" });
    expect((await verifyCredentials(db, "alice", "password123"))?.username).toBe("Alice");
  });

  test("returns null for a wrong password or unknown user", async () => {
    await createUser(db, { username: "alice", password: "password123" });
    expect(await verifyCredentials(db, "alice", "wrong-password")).toBeNull();
    expect(await verifyCredentials(db, "ghost", "password123")).toBeNull();
  });
});
