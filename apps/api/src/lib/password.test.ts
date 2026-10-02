import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  test("round-trips the correct password", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
  });

  test("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  test("uses argon2id and never stores the plain text", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("correct horse");
  });

  test("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});
