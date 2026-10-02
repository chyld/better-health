import type { Db } from "../db/client";
import { AppError } from "../lib/errors";
import { createUser, deleteUser, listUsers, resetPassword } from "../services/users";

export interface CliIO {
  out(line: string): void;
  err(line: string): void;
  /** Prompts without echoing what is typed. */
  promptHidden(prompt: string): Promise<string>;
  /** Prompts with echo; used for confirmations. */
  prompt(prompt: string): Promise<string>;
  readStdin(): Promise<string>;
}

const USAGE = `Usage:
  user:create <username> [--password-stdin]
  user:reset-password <username> [--password-stdin]
  user:list
  user:delete <username> [--yes]`;

class UsageError extends Error {}

interface Parsed {
  command: string | undefined;
  positionals: string[];
  flags: Set<string>;
}

function parseArgs(argv: readonly string[], allowedFlags: readonly string[]): Parsed {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Set<string>();
  for (const arg of rest) {
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (arg.startsWith("--password") && arg !== "--password-stdin") {
      throw new UsageError(
        "Passwords are never accepted as arguments. Omit it to be prompted, or use --password-stdin.",
      );
    }
    if (!allowedFlags.includes(arg)) throw new UsageError(`Unknown option: ${arg}`);
    flags.add(arg);
  }
  return { command, positionals, flags };
}

function oneUsername(parsed: Parsed): string {
  const [username, ...extra] = parsed.positionals;
  if (!username || extra.length > 0) throw new UsageError("Expected exactly one <username>.");
  return username;
}

async function readNewPassword(io: CliIO, fromStdin: boolean): Promise<string> {
  if (fromStdin) return (await io.readStdin()).replace(/\r?\n$/, "");
  const first = await io.promptHidden("Password: ");
  const second = await io.promptHidden("Confirm password: ");
  if (first !== second) throw new UsageError("Passwords do not match.");
  return first;
}

const FLAGS: Record<string, string[]> = {
  create: ["--password-stdin"],
  "reset-password": ["--password-stdin"],
  list: [],
  delete: ["--yes"],
};

export async function runCli(argv: readonly string[], db: Db, io: CliIO): Promise<number> {
  try {
    const command = argv[0];
    if (!command || !(command in FLAGS)) throw new UsageError(USAGE);
    const parsed = parseArgs(argv, FLAGS[command] ?? []);

    switch (command) {
      case "create": {
        const username = oneUsername(parsed);
        const password = await readNewPassword(io, parsed.flags.has("--password-stdin"));
        const user = await createUser(db, { username, password });
        io.out(`Created user "${user.username}".`);
        return 0;
      }
      case "reset-password": {
        const username = oneUsername(parsed);
        const password = await readNewPassword(io, parsed.flags.has("--password-stdin"));
        await resetPassword(db, username, password);
        io.out(`Password reset for "${username}". All of their sessions were signed out.`);
        return 0;
      }
      case "list": {
        if (parsed.positionals.length > 0) throw new UsageError("user:list takes no arguments.");
        const users = listUsers(db);
        if (users.length === 0) io.out("No users.");
        for (const u of users) io.out(`${u.username}\t${u.createdAt}`);
        return 0;
      }
      case "delete": {
        const username = oneUsername(parsed);
        if (!parsed.flags.has("--yes")) {
          const answer = await io.prompt(
            `This permanently deletes "${username}" and all of their data. Type the username to confirm: `,
          );
          if (answer.trim() !== username) {
            io.err("Aborted.");
            return 1;
          }
        }
        deleteUser(db, username);
        io.out(`Deleted user "${username}".`);
        return 0;
      }
    }
    throw new UsageError(USAGE);
  } catch (error) {
    if (error instanceof UsageError || error instanceof AppError) {
      io.err(error.message);
      return error instanceof UsageError ? 2 : 1;
    }
    throw error;
  }
}
