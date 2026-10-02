import { dirname, join } from "node:path";
import { openDb } from "../db/client";
import { ensureDbDir, loadEnv } from "../lib/env";
import { backupDatabase } from "./backup";

// Deploy helpers: `backup` copies the live database; `migrate` applies pending migrations.
const env = loadEnv();
const command = process.argv[2];

if (command === "backup") {
  const dir = process.env.BACKUP_DIR ?? join(dirname(env.DATABASE_PATH), "backups");
  const path = backupDatabase(env.DATABASE_PATH, dir);
  console.log(path ? `Backed up to ${path}` : "No database yet; nothing to back up.");
} else if (command === "migrate") {
  ensureDbDir(env.DATABASE_PATH);
  openDb(env.DATABASE_PATH).$client.close();
  console.log("Migrations applied.");
} else {
  console.error("Usage: ops <backup|migrate>");
  process.exit(2);
}
