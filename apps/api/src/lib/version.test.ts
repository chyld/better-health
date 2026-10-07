import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveVersion } from "./version";

const SHA = "1a0b97c5e2f4d8a9b0c1d2e3f405162738495a6b";
let root: string;

function repo(files: Record<string, string>) {
  root = mkdtempSync(join(tmpdir(), "better-health-version-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("reads the branch's commit from a loose or packed ref, or a detached HEAD", () => {
  expect(
    resolveVersion(
      repo({ ".git/HEAD": "ref: refs/heads/main\n", ".git/refs/heads/main": SHA }),
      {},
    ),
  ).toBe("1a0b97c");
  rmSync(root, { recursive: true });
  expect(
    resolveVersion(
      repo({
        ".git/HEAD": "ref: refs/heads/main\n",
        ".git/packed-refs": `# pack-refs\nffffffffff refs/heads/other\n${SHA} refs/heads/main\n`,
      }),
      {},
    ),
  ).toBe("1a0b97c");
  rmSync(root, { recursive: true });
  expect(resolveVersion(repo({ ".git/HEAD": `${SHA}\n` }), {})).toBe("1a0b97c");
});

test("APP_VERSION, then a VERSION file, win over git; nothing at all is dev", () => {
  const dir = repo({ ".git/HEAD": `${SHA}\n`, VERSION: "abc1234\n" });
  expect(resolveVersion(dir, { APP_VERSION: " test " })).toBe("test");
  expect(resolveVersion(dir, { APP_VERSION: "" })).toBe("abc1234");
  rmSync(root, { recursive: true });
  expect(resolveVersion(repo({}), {})).toBe("dev");
});
