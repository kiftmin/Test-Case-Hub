import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const statusAuditLogTable = pgTable("status_audit_log", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  changedByUserId: integer("changed_by_user_id").notNull().references(() => usersTable.id),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStatusAuditLogSchema = createInsertSchema(statusAuditLogTable).omit({
  id: true,
  changedAt: true,
});
export type InsertStatusAuditLog = typeof statusAuditLogTable.$inferInsert;
export type StatusAuditLog = typeof statusAuditLogTable.$inferSelect;
