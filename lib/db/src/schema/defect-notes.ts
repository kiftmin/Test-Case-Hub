import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { defectsTable } from "./defects";
import { teamDiscussionsTable } from "./team-discussions";
import { usersTable } from "./users";

export const defectNotesTable = pgTable("defect_notes", {
  id: serial("id").primaryKey(),
  defectId: integer("defect_id").notNull().references(() => defectsTable.id, { onDelete: "cascade" }),
  discussionId: integer("discussion_id").references(() => teamDiscussionsTable.id),
  addedByUserId: integer("added_by_user_id").notNull().references(() => usersTable.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDefectNoteSchema = createInsertSchema(defectNotesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDefectNote = typeof defectNotesTable.$inferInsert;
export type DefectNote = typeof defectNotesTable.$inferSelect;
