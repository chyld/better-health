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
    caloriesOut: integer("calories_out"),
    weightLbs: real("weight_lbs"),
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
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("exercise_entries_user_date_idx").on(t.userId, t.date)],
);
