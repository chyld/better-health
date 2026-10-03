import { z } from "zod";
import { isValidIsoDate, isValidIsoMonth } from "./dates";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[A-Za-z0-9_.-]+$/, "Username may only contain letters, digits, _ . and -");

export const passwordSchema = z
  .string()
  .min(1, "Password cannot be empty")
  .max(256, "Password must be at most 256 characters");

export const isoDateSchema = z.string().refine(isValidIsoDate, "Expected a date like 2026-10-02");
export const isoMonthSchema = z.string().refine(isValidIsoMonth, "Expected a month like 2026-10");

export const CALORIES_MAX = 20_000;
export const WEIGHT_MIN = 50;
export const WEIGHT_MAX = 1_000;
export const DAY_NOTE_MAX = 10_000;
export const EXERCISE_NAME_MAX = 50;
export const EXERCISE_UNIT_MAX = 20;
export const EXERCISE_CATEGORY_MAX = 30;
export const AMOUNT_MAX = 100_000;

export const caloriesSchema = z
  .number()
  .int("Calories must be a whole number")
  .min(0, "Calories cannot be negative")
  .max(CALORIES_MAX, `Calories must be at most ${CALORIES_MAX}`);

export const weightSchema = z
  .number()
  .min(WEIGHT_MIN, `Weight must be at least ${WEIGHT_MIN} lbs`)
  .max(WEIGHT_MAX, `Weight must be at most ${WEIGHT_MAX} lbs`)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, "Weight allows one decimal place");

export const dayPatchSchema = z
  .strictObject({
    caloriesIn: caloriesSchema.nullable().optional(),
    caloriesOut: caloriesSchema.nullable().optional(),
    weightLbs: weightSchema.nullable().optional(),
    note: z.string().max(DAY_NOTE_MAX).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type DayPatch = z.infer<typeof dayPatchSchema>;

const idSchema = z.number().int().positive();

/** How much of an exercise: 3 (miles), 2.5 (hours), 50 (pushups). */
export const amountSchema = z
  .number()
  .positive("Amount must be more than 0")
  .max(AMOUNT_MAX, `Amount must be at most ${AMOUNT_MAX}`)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
    "Amount allows two decimal places",
  );

export const exerciseEntryCreateSchema = z.strictObject({
  exerciseTypeId: idSchema,
  amount: amountSchema,
});
export type ExerciseEntryCreate = z.infer<typeof exerciseEntryCreateSchema>;

export const exerciseEntryPatchSchema = z
  .strictObject({ exerciseTypeId: idSchema.optional(), amount: amountSchema.optional() })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type ExerciseEntryPatch = z.infer<typeof exerciseEntryPatchSchema>;

export const exerciseNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(EXERCISE_NAME_MAX, `Name must be at most ${EXERCISE_NAME_MAX} characters`);

export const exerciseUnitSchema = z
  .string()
  .trim()
  .min(1, "Unit is required")
  .max(EXERCISE_UNIT_MAX, `Unit must be at most ${EXERCISE_UNIT_MAX} characters`);

/** A free-text grouping such as "cardio" or "strength". */
export const exerciseCategorySchema = z
  .string()
  .trim()
  .min(1, "Category is required")
  .max(EXERCISE_CATEGORY_MAX, `Category must be at most ${EXERCISE_CATEGORY_MAX} characters`);

export const exerciseTypeCreateSchema = z.strictObject({
  name: exerciseNameSchema,
  category: exerciseCategorySchema,
  unit: exerciseUnitSchema,
});

export const exerciseTypePatchSchema = z
  .strictObject({
    name: exerciseNameSchema.optional(),
    category: exerciseCategorySchema.optional(),
    unit: exerciseUnitSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type ExerciseTypePatch = z.infer<typeof exerciseTypePatchSchema>;

export const exerciseTypeOrderSchema = z.strictObject({
  ids: z
    .array(idSchema)
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids"),
});
