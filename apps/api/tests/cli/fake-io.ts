import type { CliIO } from "../../src/cli/run";

/** Scripted IO: answers prompts in order and records output. */
export function fakeIO(answers: { hidden?: string[]; prompt?: string[]; stdin?: string } = {}) {
  const hidden = [...(answers.hidden ?? [])];
  const prompts = [...(answers.prompt ?? [])];
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const io: CliIO = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    promptHidden: async (p) => {
      asked.push(p);
      const next = hidden.shift();
      if (next === undefined) throw new Error(`Unexpected hidden prompt: ${p}`);
      return next;
    },
    prompt: async (p) => {
      asked.push(p);
      const next = prompts.shift();
      if (next === undefined) throw new Error(`Unexpected prompt: ${p}`);
      return next;
    },
    readStdin: async () => {
      if (answers.stdin === undefined) throw new Error("Unexpected stdin read");
      return answers.stdin;
    },
  };
  return { io, out, err, asked };
}
