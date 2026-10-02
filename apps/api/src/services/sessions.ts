import { and, eq, gt, lte } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";
import { type Clock, DAY_MS } from "../lib/clock";
import { generateToken, hashToken } from "../lib/tokens";
import type { PublicUser } from "./users";

export const SESSION_TTL_MS = 30 * DAY_MS;
/** Expiry is pushed forward at most this often, to avoid a write on every request. */
export const SESSION_RENEW_INTERVAL_MS = DAY_MS;

export interface NewSession {
  token: string;
  expiresAt: Date;
}

export function createSession(db: Db, userId: number, clock: Clock): NewSession {
  const now = clock.now();
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  db.insert(sessions)
    .values({
      tokenHash: hashToken(token),
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    })
    .run();
  return { token, expiresAt };
}

export interface ValidSession {
  user: PublicUser;
  /** Set when the expiry was pushed forward, so the cookie can be refreshed. */
  renewedUntil: Date | null;
}

/** Looks up a live session and slides its expiry forward when due. */
export function validateSession(db: Db, token: string, clock: Clock): ValidSession | null {
  const now = clock.now();
  const tokenHash = hashToken(token);
  const row = db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now.toISOString())))
    .get();
  if (!row) return null;

  const user = { id: row.id, username: row.username, createdAt: row.createdAt };
  const fullExpiry = now.getTime() + SESSION_TTL_MS;
  if (fullExpiry - Date.parse(row.expiresAt) < SESSION_RENEW_INTERVAL_MS) {
    return { user, renewedUntil: null };
  }
  const renewedUntil = new Date(fullExpiry);
  db.update(sessions)
    .set({ expiresAt: renewedUntil.toISOString() })
    .where(eq(sessions.tokenHash, tokenHash))
    .run();
  return { user, renewedUntil };
}

export function deleteSession(db: Db, token: string): void {
  db.delete(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .run();
}

/** Removes expired sessions; returns how many were removed. */
export function sweepExpiredSessions(db: Db, clock: Clock): number {
  return db
    .delete(sessions)
    .where(lte(sessions.expiresAt, clock.now().toISOString()))
    .returning()
    .all().length;
}
