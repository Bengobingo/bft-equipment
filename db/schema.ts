import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull(),
  password: text("password").notNull(),
  active: integer("active").notNull().default(1),
  mustChange: integer("must_change").notNull().default(0),
  created: text("created").notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expires: integer("expires").notNull(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expires),
  ],
);
export const equipment = sqliteTable("equipment", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  serial: text("serial").notNull(),
  location: text("location").notNull(),
  condition: text("condition").notNull(),
  notes: text("notes").notNull(),
  created: text("created").notNull(),
});
export const loans = sqliteTable(
  "loans",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    department: text("department").notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull(),
    created: text("created").notNull(),
    updated: text("updated").notNull(),
    approverId: text("approver_id").references(() => users.id),
    decisionNote: text("decision_note").notNull().default(""),
    checkedOut: text("checked_out"),
    returned: text("returned"),
    returnNote: text("return_note").notNull().default(""),
  },
  (table) => [
    index("loans_equipment_window_idx").on(
      table.equipmentId,
      table.status,
      table.start,
      table.end,
    ),
    index("loans_user_idx").on(table.userId),
    index("loans_department_idx").on(table.department),
  ],
);
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    target: text("target").notNull(),
    detail: text("detail").notNull(),
    created: text("created").notNull(),
  },
  (table) => [
    index("events_target_idx").on(table.target),
    index("events_actor_idx").on(table.actorId),
    index("events_created_idx").on(table.created),
  ],
);
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
