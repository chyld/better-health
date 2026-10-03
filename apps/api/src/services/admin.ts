import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Db } from "../db/client";

/**
 * A consistent, compacted copy of the live database, safe to take while the app is
 * serving requests. Written to a temporary file with VACUUM INTO, read back, then removed.
 */
export async function databaseSnapshot(db: Db): Promise<ArrayBuffer> {
  const dir = mkdtempSync(join(tmpdir(), "better-health-snapshot-"));
  try {
    const target = join(dir, "snapshot.db");
    db.$client.run("VACUUM INTO ?", [target]);
    return await Bun.file(target).arrayBuffer();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
