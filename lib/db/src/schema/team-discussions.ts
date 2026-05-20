import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projectsTable } from "./projects";
import { testRunsTable } from "./test-runs";
import { usersTable } from "./users";

export const teamDiscussionsTable = pgTable("team_discussions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  testRunId: integer("test_run_id").notNull().references(() => testRunsTable.id, { onDelete: "cascade" }),
  initiatedByUserId: integer("initiated_by_user_id").notNull().references(() => usersTable.id),
  meetingType: text("meeting_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const insertTeamDiscussionSchema = createInsertSchema(teamDiscussionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTeamDiscussion = typeof teamDiscussionsTable.$inferInsert;
export type TeamDiscussion = typeof teamDiscussionsTable.$inferSelect;
