import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const migrationsFolder = join(import.meta.dir, "../../drizzle");

export function openDb(path: string) {
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") sqlite.exec("PRAGMA journal_mode = WAL;");
  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder });
  return db;
}

export type Db = ReturnType<typeof openDb>;
