import { dirname, join } from "node:path";
import { openDb } from "../db/client";
import { ensureDbDir, loadEnv } from "../lib/env";
import { backupDatabase, hasPendingMigrations } from "./backup";

// Deploy helpers: `backup` copies the live database; `backup-if-migrating` does so only when
// the next start will apply new migrations (the container runs it on every start);
// `migrate` applies pending migrations.
const env = loadEnv();
const command = process.argv[2];
const backupDir = process.env.BACKUP_DIR ?? join(dirname(env.DATABASE_PATH), "backups");

if (command === "backup") {
  const path = backupDatabase(env.DATABASE_PATH, backupDir);
  console.log(path ? `Backed up to ${path}` : "No database yet; nothing to back up.");
} else if (command === "backup-if-migrating") {
  if (hasPendingMigrations(env.DATABASE_PATH)) {
    console.log(
      `New migrations to apply; backed up to ${backupDatabase(env.DATABASE_PATH, backupDir)}`,
    );
  }
} else if (command === "migrate") {
  ensureDbDir(env.DATABASE_PATH);
  openDb(env.DATABASE_PATH).$client.close();
  console.log("Migrations applied.");
} else {
  console.error("Usage: ops <backup|backup-if-migrating|migrate>");
  process.exit(2);
}
