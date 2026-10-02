import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { staticRoutes } from "../../src/static";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "better-health-dist-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(join(dir, "assets/app-abc123.js"), "console.log(1)");
  writeFileSync(join(dir, "sw.js"), "// sw");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("static web app", () => {
  test("serves fingerprinted assets with a long cache", async () => {
    const res = await staticRoutes(dir).request("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  test("serves other files from the root", async () => {
    const res = await staticRoutes(dir).request("/sw.js");
    expect(await res.text()).toBe("// sw");
  });

  test("falls back to index.html for client routes", async () => {
    const res = await staticRoutes(dir).request("/calendar/2026-10?day=2026-10-02");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>app</title>");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  test("explains when the app has not been built", async () => {
    const res = await staticRoutes(join(dir, "missing")).request("/");
    expect(res.status).toBe(503);
  });
});
