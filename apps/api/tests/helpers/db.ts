import { openDb } from "../../src/db/client";

export function createTestDb() {
  return openDb(":memory:");
}
