import { describe, expect, test } from "bun:test";
import { sessions } from "../../src/db/schema";
import { DAY_MS } from "../../src/lib/clock";
import { createUser, resetPassword, setAdmin } from "../../src/services/users";
import { createTestApp, TEST_PASSWORD } from "../helpers/app";

const LOGIN = "/api/auth/login";

describe("POST /api/auth/login", () => {
  test("signs in and sets a secure session cookie", async () => {
    const t = createTestApp();
    const user = await createUser(t.db, { username: "alice", password: TEST_PASSWORD });

    const res = await t.json(LOGIN, "POST", { username: "alice", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: user.id, username: "alice", isAdmin: false, timeZone: "UTC" },
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("bh_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Expires=Sun, 01 Nov 2026 12:00:00 GMT");
  });

  test("accepts the username in any case", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });
    const res = await t.json(LOGIN, "POST", { username: "ALICE", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  test("stores only a hash of the session token", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });
    const cookie = await t.login("alice");
    const token = cookie.split("=")[1] ?? "";
    const rows = t.db.select().from(sessions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a wrong password and an unknown user get the same 401", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });

    const wrong = await t.json(LOGIN, "POST", { username: "alice", password: "wrong-password" });
    const unknown = await t.json(LOGIN, "POST", { username: "ghost", password: TEST_PASSWORD });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const body = {
      error: { code: "invalid_credentials", message: "Invalid username or password" },
    };
    expect(await wrong.json()).toEqual(body);
    expect(await unknown.json()).toEqual(body);
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  test.each([
    { body: {} },
    { body: { username: "alice" } },
    { body: { password: TEST_PASSWORD } },
    { body: { username: "", password: TEST_PASSWORD } },
    { body: { username: "alice", password: "" } },
    { body: { username: 5, password: TEST_PASSWORD } },
  ])("rejects a malformed body: $body", async ({ body }) => {
    const res = await createTestApp().json(LOGIN, "POST", body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("validation_error");
  });

  test("rejects invalid JSON", async () => {
    const res = await createTestApp().request(LOGIN, { method: "POST", body: "{not json" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "bad_request", message: "Malformed JSON in request body" },
    });
  });
});

describe("login rate limiting", () => {
  test("blocks a username after 5 failures in a minute, even with the right password", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });
    for (let i = 0; i < 5; i++) {
      const res = await t.json(LOGIN, "POST", { username: "alice", password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const blocked = await t.json(LOGIN, "POST", { username: "Alice", password: TEST_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
  });

  test("unblocks after the window passes", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });
    for (let i = 0; i < 5; i++) {
      await t.json(LOGIN, "POST", { username: "alice", password: "wrong-password" });
    }
    t.clock.advance(61_000);
    const res = await t.json(LOGIN, "POST", { username: "alice", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  test("does not block other usernames", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "bob", password: TEST_PASSWORD });
    for (let i = 0; i < 5; i++) {
      await t.json(LOGIN, "POST", { username: "alice", password: "wrong-password" });
    }
    const res = await t.json(LOGIN, "POST", { username: "bob", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  test("a successful login clears earlier failures", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });
    for (let i = 0; i < 4; i++) {
      await t.json(LOGIN, "POST", { username: "alice", password: "wrong-password" });
    }
    await t.login("alice");
    for (let i = 0; i < 4; i++) {
      await t.json(LOGIN, "POST", { username: "alice", password: "wrong-password" });
    }
    const res = await t.json(LOGIN, "POST", { username: "alice", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  test("returns the signed-in user", async () => {
    const t = createTestApp();
    const { user, cookie } = await t.signedInUser("alice");
    const res = await t.request("/api/auth/me", { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: user.id, username: "alice", isAdmin: false, timeZone: "UTC" },
    });
  });

  test("says when the user is an admin", async () => {
    const t = createTestApp();
    const { cookie } = await t.signedInUser("alice");
    setAdmin(t.db, "alice", true);
    const res = await t.request("/api/auth/me", { cookie });
    expect(((await res.json()) as { user: { isAdmin: boolean } }).user.isAdmin).toBe(true);
  });

  test("401 without a cookie", async () => {
    const res = await createTestApp().request("/api/auth/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "Not signed in" },
    });
  });

  test("401 and clears the cookie for an unknown token", async () => {
    const res = await createTestApp().request("/api/auth/me", { cookie: "bh_session=forged" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("bh_session=;");
  });
});

describe("POST /api/auth/logout", () => {
  test("ends the session and clears the cookie", async () => {
    const t = createTestApp();
    const { cookie } = await t.signedInUser("alice");

    const res = await t.request("/api/auth/logout", { method: "POST", cookie });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toContain("bh_session=;");

    expect((await t.request("/api/auth/me", { cookie })).status).toBe(401);
    expect(t.db.select().from(sessions).all()).toHaveLength(0);
  });

  test("only ends that session", async () => {
    const t = createTestApp();
    const { cookie: phone } = await t.signedInUser("alice");
    const laptop = await t.login("alice");
    await t.request("/api/auth/logout", { method: "POST", cookie: phone });
    expect((await t.request("/api/auth/me", { cookie: laptop })).status).toBe(200);
  });

  test("succeeds without a session", async () => {
    const res = await createTestApp().request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(204);
  });
});

describe("session lifetime", () => {
  test("expires after 30 days without activity", async () => {
    const t = createTestApp();
    const { cookie } = await t.signedInUser("alice");
    t.clock.advance(30 * DAY_MS - 1000);
    expect((await t.request("/api/auth/me", { cookie })).status).toBe(200);

    const t2 = createTestApp();
    const { cookie: c2 } = await t2.signedInUser("bob");
    t2.clock.advance(30 * DAY_MS);
    expect((await t2.request("/api/auth/me", { cookie: c2 })).status).toBe(401);
  });

  test("slides forward with activity: used on day 29, still valid on day 45", async () => {
    const t = createTestApp();
    const { cookie } = await t.signedInUser("alice");
    t.clock.advance(29 * DAY_MS);
    const renewed = await t.request("/api/auth/me", { cookie });
    expect(renewed.status).toBe(200);
    expect(renewed.headers.get("set-cookie")).toContain("Expires=");

    t.clock.advance(16 * DAY_MS);
    expect((await t.request("/api/auth/me", { cookie })).status).toBe(200);
  });

  test("renews at most once a day", async () => {
    const t = createTestApp();
    const { cookie } = await t.signedInUser("alice");
    t.clock.advance(60 * 60 * 1000);
    const early = await t.request("/api/auth/me", { cookie });
    expect(early.headers.get("set-cookie")).toBeNull();

    t.clock.advance(DAY_MS);
    const later = await t.request("/api/auth/me", { cookie });
    expect(later.headers.get("set-cookie")).toContain("bh_session=");
  });

  test("a password reset from the CLI signs the user out", async () => {
    const t = createTestApp();
    const { cookie } = await t.signedInUser("alice");
    await resetPassword(t.db, "alice", "brand-new-password");
    expect((await t.request("/api/auth/me", { cookie })).status).toBe(401);
  });
});

describe("routes that must not exist", () => {
  test.each([
    ["POST", "/api/auth/register"],
    ["POST", "/api/auth/signup"],
    ["PUT", "/api/auth/password"],
    ["POST", "/api/auth/password"],
    ["POST", "/api/users"],
  ])("%s %s is 404", async (method, path) => {
    const res = await createTestApp().json(path, method, {
      username: "x",
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(404);
  });
});

describe("CSRF", () => {
  test("rejects a cross-origin form post", async () => {
    const t = createTestApp();
    await createUser(t.db, { username: "alice", password: TEST_PASSWORD });
    const res = await t.request(LOGIN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://evil.example",
      },
      body: "username=alice&password=password123",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "forbidden", message: "Forbidden" } });
  });

  test("allows a same-origin form post through to validation", async () => {
    const res = await createTestApp().request(LOGIN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "username=alice&password=password123",
    });
    expect(res.status).not.toBe(403);
  });
});
