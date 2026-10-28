import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
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
  components: text("components").notNull().default("[]"),
  created: text("created").notNull(),
});
export const checkoutBatches = sqliteTable("checkout_batches", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull().references(() => users.id),
  borrowerId: text("borrower_id").notNull().references(() => users.id),
  productionLine: text("production_line").notNull(),
  payload: text("payload").notNull(),
  created: text("created").notNull(),
}, table => [index("checkout_batch_actor_idx").on(table.actorId, table.created)]);
export const checkoutBatchItems = sqliteTable("checkout_batch_items", {
  batchId: text("batch_id").notNull().references(() => checkoutBatches.id),
  // Failed items may reference a request that no longer exists.
  loanId: text("loan_id").notNull(),
  status: text("status", { enum: ["success", "failed"] }).notNull(),
  error: text("error").notNull().default(""),
  updated: text("updated").notNull(),
}, table => [primaryKey({ columns: [table.batchId, table.loanId] })]);
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
    productionLine: text("production_line").notNull().default(""),
    workOrder: text("work_order").notNull().default(""),
    productModel: text("product_model").notNull().default(""),
    manifest: text("manifest").notNull().default("[]"),
    checkoutBatchId: text("checkout_batch_id").references(() => checkoutBatches.id),
    checkoutCheck: text("checkout_check").notNull().default("[]"),
    returnCheck: text("return_check").notNull().default("[]"),
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
export const returnRequests = sqliteTable("return_requests", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull().references(() => loans.id),
  requesterId: text("requester_id").notNull().references(() => users.id),
  requested: text("requested").notNull(),
  requestNote: text("request_note").notNull().default(""),
  selfCheck: text("self_check"),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
  reviewerId: text("reviewer_id").references(() => users.id),
  reviewed: text("reviewed"),
  reviewNote: text("review_note").notNull().default(""),
}, table => [
  index("return_requests_loan_idx").on(table.loanId),
  uniqueIndex("return_requests_pending_idx").on(table.loanId).where(sql`${table.status} = 'pending'`),
]);
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
