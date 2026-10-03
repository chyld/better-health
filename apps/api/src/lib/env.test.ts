import { describe, expect, test } from "bun:test";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  test("applies defaults", () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_PATH).toEndWith("data/better-health.db");
  });

  test("reads and coerces values", () => {
    const env = loadEnv({ PORT: "8080", DATABASE_PATH: "/tmp/x.db", NODE_ENV: "test" });
    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_PATH).toBe("/tmp/x.db");
    expect(env.NODE_ENV).toBe("test");
  });

  test("COOKIE_SECURE is optional and must be true or false", () => {
    expect(loadEnv({}).COOKIE_SECURE).toBeUndefined();
    expect(loadEnv({ COOKIE_SECURE: "true" }).COOKIE_SECURE).toBe(true);
    expect(loadEnv({ COOKIE_SECURE: "false" }).COOKIE_SECURE).toBe(false);
    expect(() => loadEnv({ COOKIE_SECURE: "yes" })).toThrow(/Invalid environment/);
  });

  test("fails fast on bad values", () => {
    expect(() => loadEnv({ PORT: "abc" })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ NODE_ENV: "staging" })).toThrow(/Invalid environment/);
  });
});
