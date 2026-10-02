import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the real CLI entry point as a subprocess against a temp SQLite file.
let dir: string;
let dbPath: string;
const main = join(import.meta.dir, "../../src/cli/main.ts");

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "better-health-cli-"));
  dbPath = join(dir, "nested/test.db");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function cli(args: string[], stdin?: string) {
  const proc = Bun.spawn(["bun", main, ...args], {
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdin: stdin === undefined ? "ignore" : new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

test("creates the database file, then create / list / delete work end to end", async () => {
  const created = await cli(["create", "alice", "--password-stdin"], "password123\n");
  expect(created).toMatchObject({ code: 0, stdout: 'Created user "alice".\n' });

  const listed = await cli(["list"]);
  expect(listed.code).toBe(0);
  expect(listed.stdout).toStartWith("alice\t");

  const deleted = await cli(["delete", "alice", "--yes"]);
  expect(deleted.code).toBe(0);
  expect((await cli(["list"])).stdout).toBe("No users.\n");
});

test("refuses to prompt without a terminal", async () => {
  const result = await cli(["create", "bob"]);
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("--password-stdin");
});

test("exits 2 with usage for a bad command", async () => {
  const result = await cli(["nope"]);
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("Usage:");
});
