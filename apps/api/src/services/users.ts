import { DEFAULT_CELL_FIELDS, passwordSchema, usernameSchema } from "@better-health/shared";
import { asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "../db/client";
import { cellFields, sessions, users } from "../db/schema";
import { type Clock, systemClock } from "../lib/clock";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";

export type User = typeof users.$inferSelect;
export type PublicUser = Pick<User, "id" | "username" | "createdAt" | "isAdmin" | "timeZone">;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "Invalid");
  return result.data;
}

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    isAdmin: user.isAdmin,
    timeZone: user.timeZone,
  };
}

export function findUserByUsername(db: Db, username: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.trim().toLowerCase()))
    .get();
}

export function requireUser(db: Db, username: string): User {
  const user = findUserByUsername(db, username);
  if (!user) throw new NotFoundError(`User "${username}" not found`);
  return user;
}

export async function createUser(
  db: Db,
  input: { username: string; password: string },
  clock: Clock = systemClock,
): Promise<PublicUser> {
  const username = parse(usernameSchema, input.username);
  const password = parse(passwordSchema, input.password);
  if (findUserByUsername(db, username)) {
    throw new ConflictError(`User "${username}" already exists`);
  }
  const passwordHash = await hashPassword(password);
  const user = db.transaction((tx) => {
    const created = tx
      .insert(users)
      .values({ username, passwordHash, createdAt: clock.now().toISOString() })
      .returning()
      .get();
    // Calendar cells start with the usual values; the user can change them on Profile.
    tx.insert(cellFields)
      .values(DEFAULT_CELL_FIELDS.map((f, sortOrder) => ({ userId: created.id, ...f, sortOrder })))
      .run();
    return created;
  });
  return toPublic(user);
}

export function listUsers(db: Db): PublicUser[] {
  return db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)).all().map(toPublic);
}

/** Sets a new password and signs the user out everywhere. */
export async function resetPassword(db: Db, username: string, password: string): Promise<void> {
  const user = requireUser(db, username);
  const passwordHash = await hashPassword(parse(passwordSchema, password));
  db.transaction((tx) => {
    tx.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();
    tx.delete(sessions).where(eq(sessions.userId, user.id)).run();
  });
}

/** Grants or revokes admin; admins can download the whole database. */
export function setAdmin(db: Db, username: string, isAdmin: boolean): PublicUser {
  const user = requireUser(db, username);
  db.update(users).set({ isAdmin }).where(eq(users.id, user.id)).run();
  return toPublic({ ...user, isAdmin });
}

/** Sets the zone whose date decides which days the user can still change. */
export function setTimeZone(db: Db, userId: number, timeZone: string): void {
  db.update(users).set({ timeZone }).where(eq(users.id, userId)).run();
}

/** Deletes the user; their logs, labels, exercises and sessions cascade. */
export function deleteUser(db: Db, username: string): void {
  const user = requireUser(db, username);
  db.delete(users).where(eq(users.id, user.id)).run();
}

// Verified against when the username is unknown, so both failure paths cost the same.
let dummyHash: Promise<string> | undefined;

/** Returns the user when the credentials match, otherwise null. */
export async function verifyCredentials(
  db: Db,
  username: string,
  password: string,
): Promise<PublicUser | null> {
  const user = findUserByUsername(db, username);
  if (!user) {
    dummyHash ??= hashPassword("dummy-password-for-timing");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? toPublic(user) : null;
}
