import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const projectAssignmentsTable = pgTable("project_assignments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // Specific role for this project, e.g., AUTHOR, TESTER, or OWNER
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectAssignmentSchema = createInsertSchema(projectAssignmentsTable).omit({
  id: true,
  assignedAt: true,
});
export type Insert = typeof projectAssignmentsTable.$inferInsert;
export type InsertProjectAssignment = typeof projectAssignmentsTable.$inferInsert;
export type ProjectAssignment = typeof projectAssignmentsTable.$inferSelect;
