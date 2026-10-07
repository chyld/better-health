import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
};

/** The checked-out commit, shortened, read straight from .git so no git binary is needed. */
function gitCommit(root: string): string | null {
  const head = read(join(root, ".git", "HEAD"));
  if (!head) return null;
  if (!head.startsWith("ref: ")) return head.slice(0, 7);
  const ref = head.slice(5);
  const loose = read(join(root, ".git", ref));
  if (loose) return loose.slice(0, 7);
  const packed = read(join(root, ".git", "packed-refs"))
    ?.split("\n")
    .find((line) => line.endsWith(` ${ref}`));
  return packed ? packed.slice(0, 7) : null;
}

/**
 * The version of the code in `root` (the repository root): $APP_VERSION if set, else the
 * VERSION file a Docker build writes, else the checked-out commit, else "dev". Used for both
 * the server and the web build, so the two can be compared.
 */
export function resolveVersion(
  root: string,
  env: Record<string, string | undefined> = process.env,
) {
  return env.APP_VERSION?.trim() || read(join(root, "VERSION")) || gitCommit(root) || "dev";
}

// `bun apps/api/src/lib/version.ts` prints it; the Dockerfile saves it as VERSION.
if (import.meta.main) console.log(resolveVersion(join(import.meta.dir, "../../../..")));
