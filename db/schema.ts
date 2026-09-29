import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status", { enum: ["active", "frozen", "cancelled"] }).notNull().default("active"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  tcHash: text("tc_hash"),
  tcLast4: text("tc_last4"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("members_tc_hash_unique").on(table.tcHash)]);

export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  timeSlot: text("time_slot").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("reservations_member_date_unique").on(table.memberId, table.date)]);
