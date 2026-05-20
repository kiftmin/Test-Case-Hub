import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { teamDiscussionsTable } from "./team-discussions";
import { usersTable } from "./users";

export const teamDiscussionParticipantsTable = pgTable("team_discussion_participants", {
  id: serial("id").primaryKey(),
  discussionId: integer("discussion_id").notNull().references(() => teamDiscussionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  canAddNotes: boolean("can_add_notes").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamDiscussionParticipantSchema = createInsertSchema(teamDiscussionParticipantsTable).omit({
  id: true,
  addedAt: true,
});
export type InsertTeamDiscussionParticipant = typeof teamDiscussionParticipantsTable.$inferInsert;
export type TeamDiscussionParticipant = typeof teamDiscussionParticipantsTable.$inferSelect;
