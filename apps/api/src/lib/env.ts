import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const repoRoot = join(import.meta.dir, "../../../..");

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default(join(repoRoot, "data/better-health.db")),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function ensureDbDir(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
}
