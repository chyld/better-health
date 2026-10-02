import { describe, expect, test } from "bun:test";
import { generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  test("is 43 url-safe characters (32 bytes)", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("is unique", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
  });
});

describe("hashToken", () => {
  test("is a stable sha256 hex digest", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  test("differs for different tokens", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
