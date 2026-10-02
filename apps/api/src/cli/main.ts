import { openDb } from "../db/client";
import { ensureDbDir, loadEnv } from "../lib/env";
import { type CliIO, runCli } from "./run";

function promptHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new Error("No terminal for a password prompt; use --password-stdin."));
  }
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

const io: CliIO = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  promptHidden,
  prompt: async (text) => prompt(text) ?? "",
  readStdin: () => Bun.stdin.text(),
};

const env = loadEnv();
ensureDbDir(env.DATABASE_PATH);
const db = openDb(env.DATABASE_PATH);
try {
  process.exitCode = await runCli(process.argv.slice(2), db, io);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
