import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Writes a consistent copy of a live SQLite database (safe while the app is running)
 * and keeps only the newest `keep` backups. Returns the new backup's path, or null
 * when there is no database yet.
 */
export function backupDatabase(
  dbPath: string,
  backupDir: string,
  { keep = 14, now = new Date() } = {},
): string | null {
  if (!existsSync(dbPath)) return null;
  mkdirSync(backupDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const target = join(backupDir, `better-health-${stamp}.db`);
  const db = new Database(dbPath, { readonly: true });
  try {
    db.run("VACUUM INTO ?", [target]);
  } finally {
    db.close();
  }
  const backups = readdirSync(backupDir)
    .filter((f) => /^better-health-.*\.db$/.test(f))
    .sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
    rmSync(join(backupDir, old));
  }
  return target;
}
