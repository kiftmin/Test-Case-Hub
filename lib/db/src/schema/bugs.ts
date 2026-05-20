import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projectsTable } from "./projects";
import { defectsTable } from "./defects";
import { usersTable } from "./users";

export const bugsTable = pgTable("bugs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  defectId: integer("defect_id").notNull().references(() => defectsTable.id, { onDelete: "cascade" }),
  bugNumber: integer("bug_number").notNull(),
  supportTicketNumber: text("support_ticket_number"),
  assignedDeveloperId: integer("assigned_developer_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("OPEN"),
  developerNotes: text("developer_notes"),
  failedToResolveReason: text("failed_to_resolve_reason"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  testAt: timestamp("test_at", { withTimezone: true }),
  failedToResolveAt: timestamp("failed_to_resolve_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBugSchema = createInsertSchema(bugsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBug = typeof bugsTable.$inferInsert;
export type Bug = typeof bugsTable.$inferSelect;
