import { labelText } from "@better-health/shared";
import type { Db } from "../db/client";
import { AppError } from "../lib/errors";
import { deleteExerciseType, listExerciseTypesWithCounts } from "../services/exercise-types";
import {
  createUser,
  deleteUser,
  listUsers,
  requireUser,
  resetPassword,
  setAdmin,
} from "../services/users";

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
  user:delete <username> [--yes]
  user:admin <username> [--revoke]
  label:list <username>
  label:delete <username> <label-id> [--yes]`;

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
  admin: ["--revoke"],
  "label-list": [],
  "label-delete": ["--yes"],
};

const exercises = (n: number) => `${n} logged ${n === 1 ? "exercise" : "exercises"}`;

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
        for (const u of users) {
          io.out(`${u.username}\t${u.createdAt}${u.isAdmin ? "\tadmin" : ""}`);
        }
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
      case "label-list": {
        const user = requireUser(db, oneUsername(parsed));
        const labels = listExerciseTypesWithCounts(db, user.id);
        if (labels.length === 0) io.out(`"${user.username}" has no exercise labels.`);
        for (const t of labels) {
          const parts = [t.id, t.name, t.category || "-", t.unit || "-", exercises(t.entryCount)];
          if (t.archived) parts.push("archived");
          io.out(parts.join("\t"));
        }
        return 0;
      }
      case "label-delete": {
        const [username, rawId, ...extra] = parsed.positionals;
        if (!username || !rawId || extra.length > 0) {
          throw new UsageError("Expected <username> and <label-id> (see label:list).");
        }
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) throw new UsageError(`Not a label id: ${rawId}`);
        const user = requireUser(db, username);
        const label = listExerciseTypesWithCounts(db, user.id).find((t) => t.id === id);
        if (!label) {
          io.err(`"${user.username}" has no label with id ${id}. See label:list.`);
          return 1;
        }
        const what =
          label.entryCount === 0
            ? `"${labelText(label)}" (no exercises are logged with it)`
            : `"${labelText(label)}" and its ${exercises(label.entryCount)}`;
        if (!parsed.flags.has("--yes")) {
          const answer = await io.prompt(
            `This permanently deletes ${what}. Type the label name (${label.name}) to confirm: `,
          );
          if (answer.trim() !== label.name) {
            io.err("Aborted.");
            return 1;
          }
        }
        deleteExerciseType(db, user.id, id);
        io.out(`Deleted ${what}.`);
        return 0;
      }
      case "admin": {
        const username = oneUsername(parsed);
        const revoke = parsed.flags.has("--revoke");
        const user = setAdmin(db, username, !revoke);
        io.out(
          revoke
            ? `"${user.username}" is no longer an admin.`
            : `"${user.username}" is now an admin and can download the database.`,
        );
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
