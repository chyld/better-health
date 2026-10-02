import { describe, expect, test } from "bun:test";
import { passwordSchema, usernameSchema } from "./schemas";

describe("usernameSchema", () => {
  test.each(["abc", "chyld", "a.b-c_d", "User99", "x".repeat(32)])("accepts %p", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  test.each(["", "ab", "x".repeat(33), "has space", "emoji🙂", "semi;colon"])(
    "rejects %p",
    (name) => {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    },
  );

  test("trims surrounding whitespace", () => {
    expect(usernameSchema.parse("  chyld  ")).toBe("chyld");
  });
});

describe("passwordSchema", () => {
  test("requires at least 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  test("rejects passwords over 256 characters", () => {
    expect(passwordSchema.safeParse("x".repeat(256)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(257)).success).toBe(false);
  });
});
