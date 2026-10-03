import { beforeEach, describe, expect, test } from "bun:test";
import { runCli } from "../../src/cli/run";
import type { Db } from "../../src/db/client";
import { exerciseEntries, exerciseTypes, sessions } from "../../src/db/schema";
import { createUser, listUsers, verifyCredentials } from "../../src/services/users";
import { createTestDb } from "../helpers/db";
import { makeDay, makeExercise, makeExerciseType } from "../helpers/factories";
import { fakeIO } from "./fake-io";

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe("usage", () => {
  test("no command prints usage and exits 2", async () => {
    const { io, err } = fakeIO();
    expect(await runCli([], db, io)).toBe(2);
    expect(err.join("\n")).toContain("Usage:");
  });

  test("unknown command prints usage and exits 2", async () => {
    const { io, err } = fakeIO();
    expect(await runCli(["frobnicate"], db, io)).toBe(2);
    expect(err.join("\n")).toContain("Usage:");
  });

  test("unknown option is rejected", async () => {
    const { io, err } = fakeIO();
    expect(await runCli(["list", "--verbose"], db, io)).toBe(2);
    expect(err).toEqual(["Unknown option: --verbose"]);
  });

  test.each([
    { argv: ["create", "bob", "--password=secret123"] },
    { argv: ["create", "bob", "--password", "secret123"] },
    { argv: ["reset-password", "bob", "--password=secret123"] },
  ])("never accepts a password as an argument: $argv", async ({ argv }) => {
    const { io, err } = fakeIO();
    expect(await runCli(argv, db, io)).toBe(2);
    expect(err[0]).toContain("never accepted as arguments");
    expect(listUsers(db)).toEqual([]);
  });

  test("a missing username is rejected", async () => {
    const { io, err } = fakeIO();
    expect(await runCli(["create"], db, io)).toBe(2);
    expect(err).toEqual(["Expected exactly one <username>."]);
  });

  test("extra positionals are rejected", async () => {
    const { io } = fakeIO();
    expect(await runCli(["create", "bob", "alice"], db, io)).toBe(2);
  });
});

describe("create", () => {
  test("prompts twice and creates the user", async () => {
    const { io, out, asked } = fakeIO({ hidden: ["password123", "password123"] });
    expect(await runCli(["create", "bob"], db, io)).toBe(0);
    expect(asked).toEqual(["Password: ", "Confirm password: "]);
    expect(out).toEqual(['Created user "bob".']);
    expect(await verifyCredentials(db, "bob", "password123")).not.toBeNull();
  });

  test("fails when the confirmation does not match", async () => {
    const { io, err } = fakeIO({ hidden: ["password123", "password124"] });
    expect(await runCli(["create", "bob"], db, io)).toBe(2);
    expect(err).toEqual(["Passwords do not match."]);
    expect(listUsers(db)).toEqual([]);
  });

  test("reads the password from stdin without confirmation", async () => {
    const { io, asked } = fakeIO({ stdin: "password123\n" });
    expect(await runCli(["create", "bob", "--password-stdin"], db, io)).toBe(0);
    expect(asked).toEqual([]);
    expect(await verifyCredentials(db, "bob", "password123")).not.toBeNull();
  });

  test("strips only the trailing newline from stdin", async () => {
    const { io } = fakeIO({ stdin: " pass word 1 \r\n" });
    await runCli(["create", "bob", "--password-stdin"], db, io);
    expect(await verifyCredentials(db, "bob", " pass word 1 ")).not.toBeNull();
  });

  test("a duplicate username exits 1", async () => {
    await createUser(db, { username: "bob", password: "password123" });
    const { io, err } = fakeIO({ stdin: "password123" });
    expect(await runCli(["create", "BOB", "--password-stdin"], db, io)).toBe(1);
    expect(err).toEqual(['User "BOB" already exists']);
  });

  test("a short password is fine", async () => {
    const { io } = fakeIO({ hidden: ["a", "a"] });
    expect(await runCli(["create", "bob"], db, io)).toBe(0);
    expect(await verifyCredentials(db, "bob", "a")).not.toBeNull();
  });

  test("an empty password exits 1 with the reason", async () => {
    const { io, err } = fakeIO({ hidden: ["", ""] });
    expect(await runCli(["create", "bob"], db, io)).toBe(1);
    expect(err).toEqual(["Password cannot be empty"]);
  });

  test("an invalid username exits 1", async () => {
    const { io, err } = fakeIO({ hidden: ["password123", "password123"] });
    expect(await runCli(["create", "no;pe"], db, io)).toBe(1);
    expect(err[0]).toContain("Username may only contain");
  });
});

describe("reset-password", () => {
  test("changes the password and signs out sessions", async () => {
    const user = await createUser(db, { username: "bob", password: "old-password" });
    db.insert(sessions)
      .values({ tokenHash: "t", userId: user.id, expiresAt: "x", createdAt: "x" })
      .run();
    const { io, out } = fakeIO({ hidden: ["new-password", "new-password"] });

    expect(await runCli(["reset-password", "bob"], db, io)).toBe(0);
    expect(out[0]).toContain("signed out");
    expect(await verifyCredentials(db, "bob", "new-password")).not.toBeNull();
    expect(db.select().from(sessions).all()).toEqual([]);
  });

  test("an unknown user exits 1", async () => {
    const { io, err } = fakeIO({ stdin: "new-password" });
    expect(await runCli(["reset-password", "ghost", "--password-stdin"], db, io)).toBe(1);
    expect(err).toEqual(['User "ghost" not found']);
  });
});

describe("list", () => {
  test("says when there are no users", async () => {
    const { io, out } = fakeIO();
    expect(await runCli(["list"], db, io)).toBe(0);
    expect(out).toEqual(["No users."]);
  });

  test("prints one line per user", async () => {
    await createUser(db, { username: "alice", password: "password123" });
    await createUser(db, { username: "bob", password: "password123" });
    const { io, out } = fakeIO();
    await runCli(["list"], db, io);
    expect(out.map((l) => l.split("\t")[0])).toEqual(["alice", "bob"]);
  });

  test("takes no arguments", async () => {
    const { io } = fakeIO();
    expect(await runCli(["list", "extra"], db, io)).toBe(2);
  });
});

describe("admin", () => {
  test("grants and revokes admin; list marks admins", async () => {
    await createUser(db, { username: "alice", password: "password123" });
    await createUser(db, { username: "bob", password: "password123" });
    const grant = fakeIO();
    expect(await runCli(["admin", "alice"], db, grant.io)).toBe(0);
    expect(grant.out).toEqual(['"alice" is now an admin and can download the database.']);
    expect(listUsers(db).map((u) => [u.username, u.isAdmin])).toEqual([
      ["alice", true],
      ["bob", false],
    ]);
    const list = fakeIO();
    await runCli(["list"], db, list.io);
    expect(list.out.map((l) => l.split("\t")[2])).toEqual(["admin", undefined]);

    const revoke = fakeIO();
    expect(await runCli(["admin", "alice", "--revoke"], db, revoke.io)).toBe(0);
    expect(revoke.out).toEqual(['"alice" is no longer an admin.']);
    expect(listUsers(db)[0]?.isAdmin).toBe(false);
  });

  test("an unknown user exits 1", async () => {
    const { io, err } = fakeIO();
    expect(await runCli(["admin", "nobody"], db, io)).toBe(1);
    expect(err).toEqual(['User "nobody" not found']);
  });
});

describe("delete", () => {
  test("asks for confirmation and deletes on a matching answer", async () => {
    const user = await createUser(db, { username: "bob", password: "password123" });
    makeDay(db, user.id);
    const { io, out } = fakeIO({ prompt: ["bob"] });
    expect(await runCli(["delete", "bob"], db, io)).toBe(0);
    expect(out).toEqual(['Deleted user "bob".']);
    expect(listUsers(db)).toEqual([]);
  });

  test("aborts when the confirmation does not match", async () => {
    await createUser(db, { username: "bob", password: "password123" });
    const { io, err } = fakeIO({ prompt: ["no"] });
    expect(await runCli(["delete", "bob"], db, io)).toBe(1);
    expect(err).toEqual(["Aborted."]);
    expect(listUsers(db)).toHaveLength(1);
  });

  test("--yes skips the confirmation", async () => {
    await createUser(db, { username: "bob", password: "password123" });
    const { io, asked } = fakeIO();
    expect(await runCli(["delete", "bob", "--yes"], db, io)).toBe(0);
    expect(asked).toEqual([]);
  });

  test("an unknown user exits 1", async () => {
    const { io, err } = fakeIO();
    expect(await runCli(["delete", "ghost", "--yes"], db, io)).toBe(1);
    expect(err).toEqual(['User "ghost" not found']);
  });
});

describe("label-list", () => {
  test("lists a user's labels with ids and how many exercises use them", async () => {
    const user = await createUser(db, { username: "alice", password: "password123" });
    const walk = makeExerciseType(db, user.id, {
      name: "Walking",
      category: "cardio",
      unit: "miles",
    });
    makeExerciseType(db, user.id, { name: "Steps", unit: "steps", archivedAt: "x" });
    makeExercise(db, user.id, walk.id);
    makeExercise(db, user.id, walk.id);
    const { io, out } = fakeIO();
    expect(await runCli(["label-list", "alice"], db, io)).toBe(0);
    expect(out).toEqual([
      `${walk.id}\tWalking\tcardio\tmiles\t2 logged exercises`,
      expect.stringMatching(/^\d+\tSteps\t-\tsteps\t0 logged exercises\tarchived$/),
    ]);
  });

  test("says when there are none, and fails for an unknown user", async () => {
    await createUser(db, { username: "alice", password: "password123" });
    const empty = fakeIO();
    expect(await runCli(["label-list", "alice"], db, empty.io)).toBe(0);
    expect(empty.out).toEqual(['"alice" has no exercise labels.']);
    const unknown = fakeIO();
    expect(await runCli(["label-list", "nobody"], db, unknown.io)).toBe(1);
  });
});

describe("label-delete", () => {
  async function setup() {
    const user = await createUser(db, { username: "alice", password: "password123" });
    const walk = makeExerciseType(db, user.id, {
      name: "Walking",
      category: "cardio",
      unit: "miles",
    });
    const yoga = makeExerciseType(db, user.id, { name: "Yoga", unit: "minutes" });
    makeExercise(db, user.id, walk.id);
    makeExercise(db, user.id, walk.id);
    makeExercise(db, user.id, yoga.id);
    return { user, walk, yoga };
  }
  const remainingLabels = () =>
    db
      .select()
      .from(exerciseTypes)
      .all()
      .map((t) => t.name);
  const remainingEntries = () => db.select().from(exerciseEntries).all().length;

  test("asks for the label name, then deletes it and its logged exercises", async () => {
    const { walk } = await setup();
    const { io, out, asked } = fakeIO({ prompt: ["Walking"] });
    expect(await runCli(["label-delete", "alice", String(walk.id)], db, io)).toBe(0);
    expect(asked[0]).toContain('permanently deletes "Walking (miles)" and its 2 logged exercises');
    expect(out).toEqual(['Deleted "Walking (miles)" and its 2 logged exercises.']);
    expect(remainingLabels()).toEqual(["Yoga"]);
    expect(remainingEntries()).toBe(1);
  });

  test("aborts when the typed name does not match", async () => {
    const { walk } = await setup();
    const { io, err } = fakeIO({ prompt: ["walk"] });
    expect(await runCli(["label-delete", "alice", String(walk.id)], db, io)).toBe(1);
    expect(err).toEqual(["Aborted."]);
    expect(remainingLabels()).toEqual(["Walking", "Yoga"]);
    expect(remainingEntries()).toBe(3);
  });

  test("--yes skips the confirmation", async () => {
    const { yoga } = await setup();
    const { io, out, asked } = fakeIO();
    expect(await runCli(["label-delete", "alice", String(yoga.id), "--yes"], db, io)).toBe(0);
    expect(asked).toEqual([]);
    expect(out).toEqual(['Deleted "Yoga (minutes)" and its 1 logged exercise.']);
  });

  test("an unused label says so", async () => {
    const user = await createUser(db, { username: "alice", password: "password123" });
    const steps = makeExerciseType(db, user.id, { name: "Steps", unit: "steps" });
    const { io, out } = fakeIO();
    await runCli(["label-delete", "alice", String(steps.id), "--yes"], db, io);
    expect(out).toEqual(['Deleted "Steps (steps)" (no exercises are logged with it).']);
  });

  test("never touches another user's label", async () => {
    const { walk } = await setup();
    await createUser(db, { username: "bob", password: "password123" });
    const { io, err } = fakeIO();
    expect(await runCli(["label-delete", "bob", String(walk.id), "--yes"], db, io)).toBe(1);
    expect(err).toEqual([`"bob" has no label with id ${walk.id}. See label:list.`]);
    expect(remainingLabels()).toEqual(["Walking", "Yoga"]);
  });

  test("rejects a missing or malformed id", async () => {
    await setup();
    for (const args of [
      ["label-delete", "alice"],
      ["label-delete", "alice", "abc"],
      ["label-delete", "alice", "1", "2"],
    ]) {
      const { io } = fakeIO();
      expect(await runCli(args, db, io)).toBe(2);
    }
  });
});
