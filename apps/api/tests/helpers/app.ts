import { createApp } from "../../src/app";
import { fixedClock } from "../../src/lib/clock";
import { FailureLimiter } from "../../src/lib/rate-limit";
import { createUser } from "../../src/services/users";
import { createTestDb } from "./db";

export const TEST_PASSWORD = "password123";

/** A fresh app on an in-memory database with a controllable clock. */
export function createTestApp(start = "2026-10-02T12:00:00.000Z") {
  const db = createTestDb();
  const clock = fixedClock(start);
  const app = createApp({ db, clock, loginLimiter: new FailureLimiter(clock) });

  async function request(path: string, init: RequestInit & { cookie?: string } = {}) {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    // Browsers send Origin on every POST; same-origin requests pass the CSRF check.
    if (!headers.has("origin")) headers.set("origin", "http://localhost");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return app.request(path, { ...init, headers });
  }

  function json(path: string, method: string, body: unknown, cookie?: string) {
    return request(path, { method, body: JSON.stringify(body), cookie });
  }

  async function login(username: string, password = TEST_PASSWORD) {
    const res = await json("/api/auth/login", "POST", { username, password });
    if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
    return sessionCookie(res);
  }

  /** Creates a user and returns them with a signed-in cookie. */
  async function signedInUser(username: string) {
    const user = await createUser(db, { username, password: TEST_PASSWORD }, clock);
    return { user, cookie: await login(username) };
  }

  return { app, db, clock, request, json, login, signedInUser };
}

/** "bh_session=<token>" from a response's Set-Cookie header. */
export function sessionCookie(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(/bh_session=([^;]*)/);
  if (!match?.[1]) throw new Error(`no session cookie in: ${header}`);
  return `bh_session=${match[1]}`;
}
