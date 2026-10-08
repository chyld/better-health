import {
  baseCaloriesSetSchema,
  cellFieldCreateSchema,
  cellFieldOrderSchema,
  cellFieldPatchSchema,
  dayPatchSchema,
  exerciseEntryCreateSchema,
  exerciseEntryPatchSchema,
  exerciseTypeCreateSchema,
  exerciseTypeOrderSchema,
  exerciseTypePatchSchema,
  highlightRuleCreateSchema,
  highlightRuleOrderSchema,
  isoDateSchema,
  isoMonthSchema,
  type MonthResponse,
} from "@better-health/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Deps } from "../context";
import { validate } from "../lib/validate";
import { requireAuth } from "../middleware/auth";
import { requireEditableDay } from "../middleware/day-lock";
import { listBaseCalories, setBaseCalories } from "../services/base-calories";
import {
  createCellField,
  deleteCellField,
  listCellFields,
  reorderCellFields,
  updateCellField,
} from "../services/cell-fields";
import { getDay, getMonth, listHistory, listLog, listNotes, patchDay } from "../services/days";
import {
  createExerciseType,
  listExerciseTypes,
  reorderExerciseTypes,
  updateExerciseType,
} from "../services/exercise-types";
import { addExercise, deleteExercise, updateExercise } from "../services/exercises";
import {
  createHighlightRule,
  deleteHighlightRule,
  listHighlightRules,
  reorderHighlightRules,
} from "../services/highlights";

const idParam = z.coerce.number().int().positive();
const monthParams = z.object({ month: isoMonthSchema });
const dateParams = z.object({ date: isoDateSchema });
const entryParams = z.object({ date: isoDateSchema, id: idParam });
const typeParams = z.object({ id: idParam });
const ruleParams = z.object({ id: idParam });
const fieldParams = z.object({ id: idParam });
const typesQuery = z.object({ include: z.literal("archived").optional() });

export function dataRoutes(deps: Deps) {
  const { db, clock } = deps;
  const auth = requireAuth(deps);
  return new Hono<AppEnv>()
    .use("/months/*", auth)
    .use("/days/*", auth)
    .use("/days/:date", requireEditableDay(deps))
    .use("/days/:date/*", requireEditableDay(deps))
    .use("/exercise-types/*", auth)
    .use("/notes", auth)
    .use("/history", auth)
    .use("/log", auth)
    .use("/highlights", auth)
    .use("/highlights/*", auth)
    .use("/base-calories", auth)
    .use("/cell-fields", auth)
    .use("/cell-fields/*", auth)
    .get("/notes", (c) => c.json(listNotes(db, c.get("user").id), 200))
    .get("/history", (c) => c.json(listHistory(db, c.get("user").id), 200))
    .get("/log", (c) => c.json(listLog(db, c.get("user").id), 200))
    .get("/months/:month", validate("param", monthParams), (c) => {
      const { month } = c.req.valid("param");
      const body: MonthResponse = { month, days: getMonth(db, c.get("user").id, month) };
      return c.json(body, 200);
    })
    .get("/days/:date", validate("param", dateParams), (c) => {
      return c.json(getDay(db, c.get("user").id, c.req.valid("param").date), 200);
    })
    .patch("/days/:date", validate("param", dateParams), validate("json", dayPatchSchema), (c) => {
      const { date } = c.req.valid("param");
      return c.json(patchDay(db, c.get("user").id, date, c.req.valid("json"), clock), 200);
    })
    .post(
      "/days/:date/exercises",
      validate("param", dateParams),
      validate("json", exerciseEntryCreateSchema),
      (c) => {
        const { date } = c.req.valid("param");
        return c.json(addExercise(db, c.get("user").id, date, c.req.valid("json"), clock), 201);
      },
    )
    .patch(
      "/days/:date/exercises/:id",
      validate("param", entryParams),
      validate("json", exerciseEntryPatchSchema),
      (c) => {
        const { date, id } = c.req.valid("param");
        return c.json(updateExercise(db, c.get("user").id, date, id, c.req.valid("json")), 200);
      },
    )
    .delete("/days/:date/exercises/:id", validate("param", entryParams), (c) => {
      const { date, id } = c.req.valid("param");
      return c.json(deleteExercise(db, c.get("user").id, date, id), 200);
    })
    .get("/base-calories", (c) => c.json(listBaseCalories(db, c.get("user").id), 200))
    .put("/base-calories", validate("json", baseCaloriesSetSchema), (c) => {
      return c.json(setBaseCalories(db, c.get("user").id, c.req.valid("json")), 200);
    })
    .get("/cell-fields", (c) => c.json(listCellFields(db, c.get("user").id), 200))
    .post("/cell-fields", validate("json", cellFieldCreateSchema), (c) => {
      return c.json(createCellField(db, c.get("user").id, c.req.valid("json")), 201);
    })
    .put("/cell-fields/order", validate("json", cellFieldOrderSchema), (c) => {
      return c.json(reorderCellFields(db, c.get("user").id, c.req.valid("json").ids), 200);
    })
    .patch(
      "/cell-fields/:id",
      validate("param", fieldParams),
      validate("json", cellFieldPatchSchema),
      (c) => {
        const { id } = c.req.valid("param");
        return c.json(updateCellField(db, c.get("user").id, id, c.req.valid("json")), 200);
      },
    )
    .delete("/cell-fields/:id", validate("param", fieldParams), (c) => {
      return c.json(deleteCellField(db, c.get("user").id, c.req.valid("param").id), 200);
    })
    .get("/highlights", (c) => c.json(listHighlightRules(db, c.get("user").id), 200))
    .post("/highlights", validate("json", highlightRuleCreateSchema), (c) => {
      return c.json(createHighlightRule(db, c.get("user").id, c.req.valid("json")), 201);
    })
    .put("/highlights/order", validate("json", highlightRuleOrderSchema), (c) => {
      return c.json(reorderHighlightRules(db, c.get("user").id, c.req.valid("json").ids), 200);
    })
    .delete("/highlights/:id", validate("param", ruleParams), (c) => {
      return c.json(deleteHighlightRule(db, c.get("user").id, c.req.valid("param").id), 200);
    })
    .get("/exercise-types", validate("query", typesQuery), (c) => {
      const includeArchived = c.req.valid("query").include === "archived";
      return c.json(listExerciseTypes(db, c.get("user").id, { includeArchived }), 200);
    })
    .post("/exercise-types", validate("json", exerciseTypeCreateSchema), (c) => {
      return c.json(createExerciseType(db, c.get("user").id, c.req.valid("json")), 201);
    })
    .put("/exercise-types/order", validate("json", exerciseTypeOrderSchema), (c) => {
      return c.json(reorderExerciseTypes(db, c.get("user").id, c.req.valid("json").ids), 200);
    })
    .patch(
      "/exercise-types/:id",
      validate("param", typeParams),
      validate("json", exerciseTypePatchSchema),
      (c) => {
        const { id } = c.req.valid("param");
        return c.json(
          updateExerciseType(db, c.get("user").id, id, c.req.valid("json"), clock),
          200,
        );
      },
    );
}
