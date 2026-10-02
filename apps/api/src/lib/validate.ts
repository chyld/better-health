import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";

/** zValidator that answers bad input with the app's error shape. */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join(".");
      const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : "Invalid";
      return c.json({ error: { code: "validation_error", message } }, 400);
    }
  });
}
