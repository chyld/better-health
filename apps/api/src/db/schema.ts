import {
  CELL_METRICS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_METRICS,
  HIGHLIGHT_OPERATORS,
  PALETTE_COLORS,
} from "@better-health/shared";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull(),
    // Admins can download the whole database. Granted only from the CLI.
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    // IANA zone, set on the Profile page. Days lock by the date here.
    timeZone: text("time_zone").notNull().default("UTC"),
  },
  (t) => [uniqueIndex("users_username_unique").on(sql`lower(${t.username})`)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const dailyLogs = sqliteTable(
  "daily_logs",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    caloriesIn: integer("calories_in"),
    // Burned by activity, as entered; the base burn is added when the day is read. The column
    // keeps its old name: before base burns existed, what was entered was the whole burn.
    caloriesActive: integer("calories_out"),
    weightLbs: real("weight_lbs"),
    steps: integer("steps"),
    distanceMiles: real("distance_miles"),
    note: text("note"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const exerciseTypes = sqliteTable(
  "exercise_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Empty only for labels created before categories existed.
    category: text("category").notNull().default(""),
    sortOrder: integer("sort_order").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [uniqueIndex("exercise_types_user_name_unique").on(t.userId, sql`lower(${t.name})`)],
);

export const exerciseEntries = sqliteTable(
  "exercise_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    exerciseTypeId: integer("exercise_type_id")
      .notNull()
      .references(() => exerciseTypes.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("exercise_entries_user_date_idx").on(t.userId, t.date)],
);

/** Optional amounts on an entry, such as 3 miles and 30 minutes; at most one per unit. */
export const exerciseMeasurements = sqliteTable(
  "exercise_measurements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => exerciseEntries.id, { onDelete: "cascade" }),
    // Lowercase.
    unit: text("unit").notNull(),
    amount: real("amount").notNull(),
  },
  (t) => [uniqueIndex("exercise_measurements_entry_unit_unique").on(t.entryId, t.unit)],
);

export const highlightRules = sqliteTable(
  "highlight_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric", { enum: HIGHLIGHT_METRICS }).notNull(),
    // Set only for exercise rules; deleting the label deletes its rules.
    exerciseTypeId: integer("exercise_type_id").references(() => exerciseTypes.id, {
      onDelete: "cascade",
    }),
    // Exercise rules only: the unit to total, or null to count entries.
    unit: text("unit"),
    operator: text("operator", { enum: HIGHLIGHT_OPERATORS }).notNull(),
    target: real("target").notNull(),
    color: text("color", { enum: HIGHLIGHT_COLORS }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("highlight_rules_user_idx").on(t.userId)],
);

/** Each user's base burn: `calories` a day from `startsOn` until their next change. */
export const baseCalories = sqliteTable(
  "base_calories",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsOn: text("starts_on").notNull(),
    calories: integer("calories").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.startsOn] })],
);

/** What each user's calendar cells show, in order: a value and the caption before it. */
export const cellFields = sqliteTable(
  "cell_fields",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric", { enum: CELL_METRICS }).notNull(),
    // Set only for exercise fields; deleting the label deletes its fields.
    exerciseTypeId: integer("exercise_type_id").references(() => exerciseTypes.id, {
      onDelete: "cascade",
    }),
    // Exercise fields only: the unit to total, or null to count entries.
    unit: text("unit"),
    caption: text("caption").notNull(),
    // A palette colour, or null for the value's own colours.
    color: text("color", { enum: PALETTE_COLORS }),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("cell_fields_user_idx").on(t.userId)],
);
