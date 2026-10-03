import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { migrationsFolder as defaultMigrationsFolder } from "../db/client";

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

/**
 * True when an existing database has not had every migration applied yet, i.e. the
 * next start will change its schema. False when there is no database yet.
 */
export function hasPendingMigrations(
  dbPath: string,
  migrationsFolder = defaultMigrationsFolder,
): boolean {
  if (!existsSync(dbPath)) return false;
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as {
    entries: { when: number }[];
  };
  const newest = Math.max(...journal.entries.map((e) => e.when));
  const db = new Database(dbPath, { readonly: true });
  try {
    const tracked = db
      .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
      .get();
    if (!tracked) return journal.entries.length > 0;
    // Drizzle's own rule: a migration is pending when it is newer than the last one applied.
    const { last } = db.query("SELECT max(created_at) AS last FROM __drizzle_migrations").get() as {
      last: number | null;
    };
    return last === null || newest > last;
  } finally {
    db.close();
  }
}
